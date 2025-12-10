const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

/**
 * Azure Function: Elimina una prenotazione
 * 
 * Endpoint: DELETE /api/bookings/{id}
 * Path param: id della prenotazione da eliminare
 */
module.exports = async function (context, req) {
    const bookingId = req.params.id;
    
    context.log(`Richiesta di eliminazione prenotazione: ${bookingId}`);

    try {
        if (!bookingId) {
            context.res = {
                status: 400,
                body: { error: "ID prenotazione mancante" }
            };
            return;
        }

        // Prima recupera la prenotazione per ottenere il partition key (roomId)
        const querySpec = {
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: bookingId }]
        };

        const { resources: bookings } = await container.items
            .query(querySpec)
            .fetchAll();

        if (bookings.length === 0) {
            context.res = {
                status: 404,
                body: {
                    error: "Prenotazione non trovata",
                    id: bookingId
                }
            };
            return;
        }

        const booking = bookings[0];

        // Elimina la prenotazione
        await container.item(bookingId, booking.roomId).delete();

        context.log(`Prenotazione eliminata: ${bookingId}`);

        context.res = {
            status: 200,
            body: {
                success: true,
                message: "Prenotazione eliminata con successo",
                deletedBooking: {
                    id: booking.id,
                    roomId: booking.roomId,
                    date: booking.date,
                    course: booking.course
                }
            }
        };

    } catch (error) {
        context.log.error('Errore nell\'eliminazione della prenotazione:', error);

        if (error.code === 404) {
            context.res = {
                status: 404,
                body: {
                    error: "Prenotazione non trovata",
                    id: bookingId
                }
            };
        } else {
            context.res = {
                status: 500,
                body: {
                    error: "Errore interno del server",
                    message: error.message
                }
            };
        }
    }
};
