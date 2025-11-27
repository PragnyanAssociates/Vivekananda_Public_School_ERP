import polyline from '@mapbox/polyline';

const OSRM_API_URL = 'http://router.project-osrm.org/route/v1/driving/';

export const getRoadPath = async (stops) => {
    if (!stops || stops.length < 2) return [];

    try {
        const coordinatesString = stops
            .map(stop => `${stop.stop_lng},${stop.stop_lat}`)
            .join(';');

        const response = await fetch(
            `${OSRM_API_URL}${coordinatesString}?overview=full&geometries=polyline`
        );
        const json = await response.json();

        if (json.routes && json.routes.length > 0) {
            const points = polyline.decode(json.routes[0].geometry);
            return points.map(point => ({ latitude: point[0], longitude: point[1] }));
        }
        return [];
    } catch (error) {
        console.error("OSRM Error:", error);
        return [];
    }
};