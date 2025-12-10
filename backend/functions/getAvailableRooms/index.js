const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

// Lista delle aule disponibili nell'edificio (hardcoded per la demo)
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
 * Azure Function: Trova aule disponibili per data e fascia oraria
 * 
 * Endpoint: GET /api/rooms/available?date=2024-12-15&startTime=09:00&endTime=11:00
 * Query params (obbligatori):
 *   - date: data (YYYY-MM-DD)
 *   - startTime: orario inizio (HH:MM)
 *   - endTime: orario fine (HH:MM)
 * Query params (opzionali):
 *   - minCapacity: capacità minima richiesta
 */
module.exports = async function (context, req) {
    context.log('Richiesta aule disponibili');

    try {
        // Validazione parametri obbligatori
        const { date, startTime, endTime } = req.query;

        if (!date || !startTime || !endTime) {
            context.res = {
                status: 400,
                body: {
                    error: "Parametri obbligatori mancanti",
                    required: ["date", "startTime", "endTime"]
                }
            };
            return;
        }

        // Validazione formati
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const timeRegex = /^\d{2}:\d{2}$/;

        if (!dateRegex.test(date) || !timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            context.res = {
                status: 400,
                body: {
                    error: "Formato non valido",
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
                body: { error: "L'orario di fine deve essere successivo all'orario di inizio" }
            };
            return;
        }

        // Recupera tutte le prenotazioni per la data richiesta
        const querySpec = {
            query: "SELECT * FROM c WHERE c.date = @date",
            parameters: [{ name: "@date", value: date }]
        };

        const { resources: bookings } = await container.items
            .query(querySpec)
            .fetchAll();

        context.log(`Trovate ${bookings.length} prenotazioni per il ${date}`);

        // Filtra aule disponibili
        const availableRooms = ALL_ROOMS.filter(room => {
            // Trova tutte le prenotazioni per questa aula
            const roomBookings = bookings.filter(b => b.roomId === room.id);

            // Controlla se c'è conflitto con l'orario richiesto
            const hasConflict = roomBookings.some(booking => {
                // C'è conflitto se gli orari si sovrappongono
                return !(endTime <= booking.startTime || startTime >= booking.endTime);
            });

            return !hasConflict;
        });

        // Filtra per capacità minima se richiesto
        let filteredRooms = availableRooms;
        const minCapacity = req.query.minCapacity ? parseInt(req.query.minCapacity) : 0;
        
        if (minCapacity > 0) {
            filteredRooms = availableRooms.filter(room => room.capacity >= minCapacity);
        }

        // Per ogni aula, aggiungi info sulle prenotazioni del giorno
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

        context.log(`Trovate ${filteredRooms.length} aule disponibili`);

        // Risposta
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
        context.log.error('Errore nella ricerca aule disponibili:', error);

        context.res = {
            status: 500,
            body: {
                error: "Errore interno del server",
                message: error.message
            }
        };
    }
};
