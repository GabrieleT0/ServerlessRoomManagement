const { CosmosClient } = require("@azure/cosmos");

// Inizializza Cosmos DB client
const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

/**
 * Azure Function: Crea una nuova prenotazione
 * 
 * Endpoint: POST /api/bookings
 * Body: {
 *   roomId: string,
 *   date: string (YYYY-MM-DD),
 *   startTime: string (HH:MM),
 *   endTime: string (HH:MM),
 *   professorName: string,
 *   course: string,
 *   notes: string (optional)
 * }
 */
module.exports = async function (context, req) {
    context.log('Richiesta di prenotazione ricevuta');

    try {
        // Validazione input
        const { roomId, date, startTime, endTime, professorName, course, notes } = req.body;

        if (!roomId || !date || !startTime || !endTime || !professorName || !course) {
            context.res = {
                status: 400,
                body: {
                    error: "Campi obbligatori mancanti",
                    required: ["roomId", "date", "startTime", "endTime", "professorName", "course"]
                }
            };
            return;
        }

        // Validazione formato data
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            context.res = {
                status: 400,
                body: { error: "Formato data non valido. Usa YYYY-MM-DD" }
            };
            return;
        }

        // Validazione formato orari
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            context.res = {
                status: 400,
                body: { error: "Formato orario non valido. Usa HH:MM" }
            };
            return;
        }

        // Verifica che l'orario di fine sia dopo l'orario di inizio
        if (startTime >= endTime) {
            context.res = {
                status: 400,
                body: { error: "L'orario di fine deve essere successivo all'orario di inizio" }
            };
            return;
        }

        // Verifica conflitti con prenotazioni esistenti
        const querySpec = {
            query: "SELECT * FROM c WHERE c.roomId = @roomId AND c.date = @date",
            parameters: [
                { name: "@roomId", value: roomId },
                { name: "@date", value: date }
            ]
        };

        const { resources: existingBookings } = await container.items
            .query(querySpec)
            .fetchAll();

        // Controlla sovrapposizioni
        const hasConflict = existingBookings.some(booking => {
            // Controlla se c'è sovrapposizione tra gli orari
            return !(endTime <= booking.startTime || startTime >= booking.endTime);
        });

        if (hasConflict) {
            context.res = {
                status: 409,
                body: {
                    error: "Conflitto: aula già prenotata in questo orario",
                    existingBookings: existingBookings.map(b => ({
                        startTime: b.startTime,
                        endTime: b.endTime,
                        course: b.course
                    }))
                }
            };
            return;
        }

        // Crea la prenotazione
        const booking = {
            id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            roomId,
            date,
            startTime,
            endTime,
            professorName,
            course,
            notes: notes || "",
            createdAt: new Date().toISOString()
        };

        const { resource: createdBooking } = await container.items.create(booking);

        context.log(`Prenotazione creata: ${createdBooking.id}`);

        // Inivia risposta di successo al client
        context.res = {
            status: 201,
            body: {
                success: true,
                message: "Prenotazione creata con successo",
                booking: createdBooking
            }
        };

    } catch (error) {
        context.log.error('Errore nella creazione della prenotazione:', error);

        context.res = {
            status: 500,
            body: {
                error: "Errore interno del server",
                message: error.message
            }
        };
    }
};
