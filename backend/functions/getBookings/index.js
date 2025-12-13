const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

/**
 * Azure Function: Retrieve bookings with optional filters
 * 
 * Endpoint: GET /api/bookings?roomId=A101&date=2024-12-15
 * Query params (all optional):
 *   - roomId: filter by specific room
 *   - date: filter by date (YYYY-MM-DD)
 *   - professorName: filter by professor
 */
module.exports = async function (context, req) {
    context.log('Bookings read request');

    try {
        // Build dynamic query based on parameters
        let query = "SELECT * FROM c";
        const parameters = [];
        const conditions = [];

        // Filter by room
        if (req.query.roomId) {
            conditions.push("c.roomId = @roomId");
            parameters.push({ name: "@roomId", value: req.query.roomId });
        }

        // Filter by date
        if (req.query.date) {
            conditions.push("c.date = @date");
            parameters.push({ name: "@date", value: req.query.date });
        }

        // Filter by professor
        if (req.query.professorName) {
            conditions.push("CONTAINS(LOWER(c.professorName), LOWER(@professorName))");
            parameters.push({ name: "@professorName", value: req.query.professorName });
        }

        // Add conditions to query
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        // Order by date and time
        query += " ORDER BY c.date, c.startTime";

        const querySpec = {
            query: query,
            parameters: parameters
        };

        context.log(`Query: ${query}`);

        // Execute query
        const { resources: bookings } = await container.items
            .query(querySpec)
            .fetchAll();

        context.log(`Found ${bookings.length} bookings`);

        // Add helpful metadata
        const response = {
            count: bookings.length,
            filters: {
                roomId: req.query.roomId || null,
                date: req.query.date || null,
                professorName: req.query.professorName || null
            },
            bookings: bookings.map(b => ({
                id: b.id,
                roomId: b.roomId,
                date: b.date,
                startTime: b.startTime,
                endTime: b.endTime,
                professorName: b.professorName,
                course: b.course,
                notes: b.notes,
                createdAt: b.createdAt
            }))
        };

        context.res = {
            status: 200,
            body: response
        };

    } catch (error) {
        context.log.error('Error retrieving bookings:', error);

        context.res = {
            status: 500,
            body: {
                error: "Internal server error",
                message: error.message
            }
        };
    }
};
