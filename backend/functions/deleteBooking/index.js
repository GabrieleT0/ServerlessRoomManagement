const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

/**
 * Azure Function: Delete a booking
 * 
 * Endpoint: DELETE /api/bookings/{id}
 * Path param: id of the booking to delete
 */
module.exports = async function (context, req) {
    const bookingId = req.params.id;
    
    context.log(`Booking delete request: ${bookingId}`);

    try {
        if (!bookingId) {
            context.res = {
                status: 400,
                body: { error: "Missing booking ID" }
            };
            return;
        }

        // First fetch the booking to get the partition key (roomId)
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
                    error: "Booking not found",
                    id: bookingId
                }
            };
            return;
        }

        const booking = bookings[0];

        // Delete booking
        await container.item(bookingId, booking.roomId).delete();

        context.log(`Booking deleted: ${bookingId}`);

        context.res = {
            status: 200,
            body: {
                success: true,
                message: "Booking deleted successfully",
                deletedBooking: {
                    id: booking.id,
                    roomId: booking.roomId,
                    date: booking.date,
                    course: booking.course
                }
            }
        };

    } catch (error) {
        context.log.error('Error while deleting booking:', error);

        if (error.code === 404) {
            context.res = {
                status: 404,
                body: {
                    error: "Booking not found",
                    id: bookingId
                }
            };
        } else {
            context.res = {
                status: 500,
                body: {
                    error: "Internal server error",
                    message: error.message
                }
            };
        }
    }
};
