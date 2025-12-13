const { CosmosClient } = require("@azure/cosmos");

// Initialize Cosmos DB client
const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

/**
 * Azure Function: Create a new booking
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
    context.log('Booking request received');

    try {
        // Input validation
        const { roomId, date, startTime, endTime, professorName, course, notes } = req.body;

        if (!roomId || !date || !startTime || !endTime || !professorName || !course) {
            context.res = {
                status: 400,
                body: {
                    error: "Missing required fields",
                    required: ["roomId", "date", "startTime", "endTime", "professorName", "course"]
                }
            };
            return;
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            context.res = {
                status: 400,
                body: { error: "Invalid date format. Use YYYY-MM-DD" }
            };
            return;
        }

        // Validate time format
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            context.res = {
                status: 400,
                body: { error: "Invalid time format. Use HH:MM" }
            };
            return;
        }

        // Ensure end time is after start time
        if (startTime >= endTime) {
            context.res = {
                status: 400,
                body: { error: "End time must be after start time" }
            };
            return;
        }

        // Check conflicts with existing bookings
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

        // Check for overlaps
        const hasConflict = existingBookings.some(booking => {
            // Check if time ranges overlap
            return !(endTime <= booking.startTime || startTime >= booking.endTime);
        });

        if (hasConflict) {
            context.res = {
                status: 409,
                body: {
                    error: "Conflict: room already booked for this time slot",
                    existingBookings: existingBookings.map(b => ({
                        startTime: b.startTime,
                        endTime: b.endTime,
                        course: b.course
                    }))
                }
            };
            return;
        }

        // Create booking payload
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

        context.log(`Booking created: ${createdBooking.id}`);

        // Send success response to client
        context.res = {
            status: 201,
            body: {
                success: true,
                message: "Booking created successfully",
                booking: createdBooking
            }
        };

    } catch (error) {
        context.log.error('Error while creating booking:', error);

        context.res = {
            status: 500,
            body: {
                error: "Internal server error",
                message: error.message
            }
        };
    }
};
