// Coordinate Mapping System
// This file shows you where to put real coordinates and referenced coordinates

/**
 * REAL GPS COORDINATES - These come from your graph.js file (Google Maps coordinates)
 * These are the actual GPS coordinates from Google Maps
 * 
 * FORMAT: { lat: number, lng: number }
 * 
 * These coordinates are already defined in your graph.js file
 * You can import them from '../routing/graph' or copy them here for reference
 */

export const realGPSCoordinates = {
  // These are the REAL GPS coordinates from Google Maps (from your graph.js)
  // Main entry point
  ENTRY: { lat: 7.2522506, lng: 80.5933134 },
  
  // Regular nodes
  node1: { lat: 7.2522769, lng: 80.5930107 },
  node2: { lat: 7.2523099, lng: 80.5925297 },
  node3: { lat: 7.253893, lng: 80.5930046 },
  node4: { lat: 7.253888, lng: 80.5925685 },
  node8: { lat: 7.253602, lng: 80.5925657 },
  node24: { lat: 7.2536023, lng: 80.5923867 },
};

/**
 * SVG MAP COORDINATES - These are the coordinates you get by clicking on the SVG map overlay
 * Use the Coordinate Finder tool to get these coordinates
 * 
 * FORMAT: { lat: number, lng: number }
 * 
 * Example of how to get SVG coordinates:
 * 1. Enable "Coordinate Finder" in the map controls
 * 2. Click on the SVG map overlay where the junction appears
 * 3. Copy the coordinates from the Coordinate Finder panel
 * 4. Paste them below in the svgMapCoordinates object
 */

export const svgMapCoordinates = {
  // PUT YOUR SVG MAP COORDINATES HERE
  // Get these by clicking on the SVG map overlay using Coordinate Finder
  
  // Example SVG coordinates (replace with your actual coordinates from clicking on SVG)
  ENTRY: { lat: 7.2522506, lng: 80.5933134 },  // Click on SVG where ENTRY appears
  node1: { lat: 7.2522769, lng: 80.5930307 },  // Click on SVG where node1 appears
  node2: { lat: 7.2522999, lng: 80.5925497 },  // Click on SVG where node2 appears
  node3: { lat: 7.25397024793652, lng: 80.59239663183689 },   // Click on SVG where node3 appears
  node4: { lat: 7.2539307538269036, lng: 80.59231314808132 },   // Click on SVG where node4 appears
  node8: { lat: 7.253615, lng: 80.592577 },
  node24: { lat: 7.253618, lng: 80.592386 }
};

/**
 * COORDINATE MAPPING - This maps REAL GPS coordinates to SVG MAP coordinates
 * 
 * This is where you create the relationship between:
 * - Real GPS coordinates (from Google Maps - in your graph.js)
 * - SVG Map coordinates (from clicking on SVG overlay - using Coordinate Finder)
 * 
 * FORMAT: {
 *   nodeId: {
 *     realGPS: { lat: number, lng: number },      // From graph.js (Google Maps)
 *     svgGPS: { lat: number, lng: number },       // From clicking on SVG overlay
 *     tolerance: number,                          // meters - how close user needs to be
 *     name: string
 *   }
 * }
 */

export const coordinateMapping = {
  // Path: ENTRY -> node1 -> node2 -> node8 -> node24
  ENTRY: {
    realGPS: realGPSCoordinates.ENTRY,            // Real GPS coordinate from graph.js (Google Maps)
    svgGPS: svgMapCoordinates.ENTRY,              // SVG coordinate from clicking on SVG overlay
    tolerance: 15,                                // 15 meters tolerance
    name: "Main Entry Point"
  },
  
  node1: {
    realGPS: realGPSCoordinates.node1,            // Real GPS coordinate from graph.js (Google Maps)
    svgGPS: svgMapCoordinates.node1,              // SVG coordinate from clicking on SVG overlay
    tolerance: 10,                                // 10 meters tolerance
    name: "Junction 1"
  },
  
  node2: {
    realGPS: realGPSCoordinates.node2,            // Real GPS coordinate from graph.js (Google Maps)
    svgGPS: svgMapCoordinates.node2,              // SVG coordinate from clicking on SVG overlay
    tolerance: 10,                                // 10 meters tolerance
    name: "Junction 2"
  },
  
  node8: {
    realGPS: realGPSCoordinates.node8,            // Real GPS coordinate from graph.js (Google Maps)
    svgGPS: svgMapCoordinates.node8,              // SVG coordinate from clicking on SVG overlay
    tolerance: 10,                                // 10 meters tolerance
    name: "Junction 8"
  },
  
  node24: {
    realGPS: realGPSCoordinates.node24,           // Real GPS coordinate from graph.js (Google Maps)
    svgGPS: svgMapCoordinates.node24,             // SVG coordinate from clicking on SVG overlay
    tolerance: 10,                                // 10 meters tolerance
    name: "Junction 24"
  },
  
  // Add more mappings for other nodes as needed...
};

/**
 * Helper function to find the closest mapping when user is at a real GPS position
 * @param {Object} userGPS - { lat: number, lng: number } - User's current GPS position
 * @returns {Object|null} - The closest mapping or null if none found
 */
export function findClosestMapping(userGPS) {
  let closestMapping = null;
  let minDistance = Infinity;

  for (const [nodeId, mapping] of Object.entries(coordinateMapping)) {
    const distance = calculateDistance(
      userGPS.lat, userGPS.lng,
      mapping.realGPS.lat, mapping.realGPS.lng
    );

    if (distance <= mapping.tolerance && distance < minDistance) {
      minDistance = distance;
      closestMapping = {
        nodeId,
        ...mapping,
        distance
      };
    }
  }

  return closestMapping;
}

/**
 * Get the SVG coordinate for a given node ID
 * @param {string} nodeId - The node identifier (e.g., 'node1', 'ENTRY')
 * @returns {Object|null} - The SVG coordinate or null if not found
 */
export function getSVGCoordinate(nodeId) {
  const mapping = coordinateMapping[nodeId];
  return mapping ? mapping.svgGPS : null;
}

/**
 * Get the real GPS coordinate for a given node ID
 * @param {string} nodeId - The node identifier (e.g., 'node1', 'ENTRY')
 * @returns {Object|null} - The real GPS coordinate or null if not found
 */
export function getRealGPSCoordinate(nodeId) {
  const mapping = coordinateMapping[nodeId];
  return mapping ? mapping.realGPS : null;
}

/**
 * Create a path connecting specific nodes
 * @param {Array} nodeIds - Array of node IDs to connect in order
 * @returns {Array} - Array of SVG coordinates for the path
 */
export function createPath(nodeIds) {
  const path = [];
  for (const nodeId of nodeIds) {
    const svgCoord = getSVGCoordinate(nodeId);
    if (svgCoord) {
      path.push([svgCoord.lat, svgCoord.lng]);
    }
  }
  return path;
}

/**
 * Predefined paths
 */
export const predefinedPaths = {
  // Main path: ENTRY -> node1 -> node2 -> node8 -> node24
  mainPath: createPath(['ENTRY', 'node1', 'node2', 'node8', 'node24']),
  
  // You can add more predefined paths here
  // alternativePath: createPath(['ENTRY', 'node1', 'node3', 'node8']),
};

/**
 * Calculate distance between two GPS coordinates in meters
 * @param {number} lat1 
 * @param {number} lng1 
 * @param {number} lat2 
 * @param {number} lng2 
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * INSTRUCTIONS FOR USING THIS FILE:
 * 
 * 1. GET SVG MAP COORDINATES:
 *    - Enable "Coordinate Finder" in the map controls
 *    - Click on the SVG map overlay where each junction appears
 *    - Copy the coordinates from the Coordinate Finder panel
 *    - Paste them in the svgMapCoordinates object above
 * 
 * 2. REAL GPS COORDINATES:
 *    - These are already in your graph.js file (from Google Maps)
 *    - They are copied to the realGPSCoordinates object above
 * 
 * 3. CREATE MAPPINGS:
 *    - In the coordinateMapping object, create relationships between:
 *      - Real GPS coordinates (from graph.js - Google Maps)
 *      - SVG Map coordinates (from clicking on SVG overlay)
 *    - Set appropriate tolerance values (how close user needs to be)
 * 
 * 4. USE THE MAPPING:
 *    - Use findClosestMapping(userGPS) to find which SVG coordinate
 *      corresponds to a user's real GPS position
 *    - This allows you to treat the user as being at the SVG coordinate
 *      when they're actually at the real GPS coordinate
 * 
 * EXAMPLE USAGE:
 * 
 * import { findClosestMapping, getSVGCoordinate } from './coordinateMapping';
 * 
 * // When user's GPS position is detected
 * const userGPS = { lat: 7.2522506, lng: 80.5933134 };
 * const mapping = findClosestMapping(userGPS);
 * 
 * if (mapping) {
 *   console.log(`User is at ${mapping.name}`);
 *   console.log(`Real GPS: ${mapping.realGPS.lat}, ${mapping.realGPS.lng}`);
 *   console.log(`SVG Position: ${mapping.svgGPS.lat}, ${mapping.svgGPS.lng}`);
 *   // Use mapping.svgGPS for navigation/routing in your SVG system
 * }
 * 
 * WORKFLOW:
 * 1. User's GPS shows they're at real GPS coordinate (from Google Maps)
 * 2. System finds closest mapping in coordinateMapping
 * 3. System treats user as being at the corresponding SVG coordinate
 * 4. Navigation/routing uses the SVG coordinate system
 */
