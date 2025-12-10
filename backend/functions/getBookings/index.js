const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

/**
 * Azure Function: Recupera prenotazioni con filtri opzionali
 * 
 * Endpoint: GET /api/bookings?roomId=A101&date=2024-12-15
 * Query params (tutti opzionali):
 *   - roomId: filtra per aula specifica
 *   - date: filtra per data (YYYY-MM-DD)
 *   - professorName: filtra per professore
 */
module.exports = async function (context, req) {
    context.log('Richiesta di lettura prenotazioni');

    try {
        // Costruisci query dinamica basata sui parametri
        let query = "SELECT * FROM c";
        const parameters = [];
        const conditions = [];

        // Filtro per aula
        if (req.query.roomId) {
            conditions.push("c.roomId = @roomId");
            parameters.push({ name: "@roomId", value: req.query.roomId });
        }

        // Filtro per data
        if (req.query.date) {
            conditions.push("c.date = @date");
            parameters.push({ name: "@date", value: req.query.date });
        }

        // Filtro per professore
        if (req.query.professorName) {
            conditions.push("CONTAINS(LOWER(c.professorName), LOWER(@professorName))");
            parameters.push({ name: "@professorName", value: req.query.professorName });
        }

        // Aggiungi condizioni alla query
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        // Ordina per data e ora
        query += " ORDER BY c.date, c.startTime";

        const querySpec = {
            query: query,
            parameters: parameters
        };

        context.log(`Query: ${query}`);

        // Esegui query
        const { resources: bookings } = await container.items
            .query(querySpec)
            .fetchAll();

        context.log(`Trovate ${bookings.length} prenotazioni`);

        // Aggiungi metadati utili
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
        context.log.error('Errore nel recupero delle prenotazioni:', error);

        context.res = {
            status: 500,
            body: {
                error: "Errore interno del server",
                message: error.message
            }
        };
    }
};
