const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

// List of available rooms in the building (hardcoded for the demo)
const ALL_ROOMS = [
    { id: "A101", capacity: 30, hasProjector: true, building: "A" },
    { id: "A102", capacity: 50, hasProjector: true, building: "A" },
    { id: "A103", capacity: 80, hasProjector: true, building: "A" },
    { id: "B201", capacity: 40, hasProjector: true, building: "B" },
    { id: "B202", capacity: 60, hasProjector: true, building: "B" },
    { id: "C301", capacity: 100, hasProjector: true, building: "C" },
    { id: "LAB1", capacity: 25, hasProjector: true, building: "LAB", isLab: true },
    { id: "LAB2", capacity: 25, hasProjector: true, building: "LAB", isLab: true }
];

/**
 * Azure Function: Find available rooms for a given date and time range
 * 
 * Endpoint: GET /api/rooms/available?date=2024-12-15&startTime=09:00&endTime=11:00
 * Required query params:
 *   - date: date (YYYY-MM-DD)
 *   - startTime: start time (HH:MM)
 *   - endTime: end time (HH:MM)
 * Optional query params:
 *   - minCapacity: minimum required capacity
 */
module.exports = async function (context, req) {
    context.log('Available rooms request');

    try {
        // Validate required parameters
        const { date, startTime, endTime } = req.query;

        if (!date || !startTime || !endTime) {
            context.res = {
                status: 400,
                body: {
                    error: "Missing required parameters",
                    required: ["date", "startTime", "endTime"]
                }
            };
            return;
        }

        // Validate formats
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const timeRegex = /^\d{2}:\d{2}$/;

        if (!dateRegex.test(date) || !timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            context.res = {
                status: 400,
                body: {
                    error: "Invalid format",
                    formats: {
                        date: "YYYY-MM-DD",
                        time: "HH:MM"
                    }
                }
            };
            return;
        }

        if (startTime >= endTime) {
            context.res = {
                status: 400,
                body: { error: "End time must be after start time" }
            };
            return;
        }

        // Fetch all bookings for the requested date
        const querySpec = {
            query: "SELECT * FROM c WHERE c.date = @date",
            parameters: [{ name: "@date", value: date }]
        };

        const { resources: bookings } = await container.items
            .query(querySpec)
            .fetchAll();

        context.log(`Found ${bookings.length} bookings for ${date}`);

        // Filter available rooms
        const availableRooms = ALL_ROOMS.filter(room => {
            // Find all bookings for this room
            const roomBookings = bookings.filter(b => b.roomId === room.id);

            // Check for conflicts with requested time
            const hasConflict = roomBookings.some(booking => {
                // Conflict exists if times overlap
                return !(endTime <= booking.startTime || startTime >= booking.endTime);
            });

            return !hasConflict;
        });

        // Filter by minimum capacity if requested
        let filteredRooms = availableRooms;
        const minCapacity = req.query.minCapacity ? parseInt(req.query.minCapacity) : 0;
        
        if (minCapacity > 0) {
            filteredRooms = availableRooms.filter(room => room.capacity >= minCapacity);
        }

        // For each room, add info about the day's bookings
        const roomsWithSchedule = filteredRooms.map(room => {
            const dayBookings = bookings
                .filter(b => b.roomId === room.id)
                .map(b => ({
                    startTime: b.startTime,
                    endTime: b.endTime,
                    course: b.course
                }))
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

            return {
                ...room,
                bookingsToday: dayBookings.length,
                schedule: dayBookings
            };
        });

        context.log(`Found ${filteredRooms.length} available rooms`);

        // Response
        context.res = {
            status: 200,
            body: {
                requestedSlot: {
                    date,
                    startTime,
                    endTime
                },
                totalRooms: ALL_ROOMS.length,
                availableCount: filteredRooms.length,
                rooms: roomsWithSchedule
            }
        };

    } catch (error) {
        context.log.error('Error while searching available rooms:', error);

        context.res = {
            status: 500,
            body: {
                error: "Internal server error",
                message: error.message
            }
        };
    }
};
