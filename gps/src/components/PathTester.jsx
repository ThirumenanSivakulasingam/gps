// Path Tester Component
// Simulates a user walking along the predefined path for testing
import { useState, useEffect, useRef } from 'react';
import { CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { coordinateMapping, predefinedPaths } from '../utils/coordinateMapping';

// Test user marker
const testUserIcon = L.divIcon({
  className: "test-user-marker",
  html: `<div style="width:20px;height:20px;border-radius:50%;
         background:#ff0000; border:3px solid white; box-shadow:0 0 10px rgba(255,0,0,.8);
         display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:white;">T</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export default function PathTester({ 
  isActive = false, 
  onTestProgress = null 
}) {
  const map = useMap();
  const [isWalking, setIsWalking] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [testResults, setTestResults] = useState([]);
  
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // Path: ENTRY -> node1 -> node2 -> node8 -> node24
  const testPath = ['ENTRY', 'node1', 'node2', 'node8', 'node24'];
  const pathCoordinates = testPath.map(nodeId => {
    const mapping = coordinateMapping[nodeId];
    return mapping ? mapping.realGPS : null;
  }).filter(coord => coord !== null);

  // Start walking simulation
  const startWalking = () => {
    if (pathCoordinates.length === 0) {
      console.error('No path coordinates available for testing');
      return;
    }

    setIsWalking(true);
    setCurrentStep(0);
    setCurrentPosition(pathCoordinates[0]);
    setTestResults([]);
    startTimeRef.current = Date.now();

    console.log('🚶 Starting path test:', testPath);
    console.log('📍 Path coordinates:', pathCoordinates);

    // Start the walking simulation
    intervalRef.current = setInterval(() => {
      setCurrentStep(prevStep => {
        const nextStep = prevStep + 1;
        
        if (nextStep >= pathCoordinates.length) {
          // Reached the end
          setIsWalking(false);
          clearInterval(intervalRef.current);
          
          const totalTime = Date.now() - startTimeRef.current;
          console.log('🏁 Path test completed in', totalTime, 'ms');
          
          onTestProgress?.({
            type: 'completed',
            totalTime,
            results: testResults
          });
          
          return prevStep;
        }

        // Move to next position
        const newPosition = pathCoordinates[nextStep];
        setCurrentPosition(newPosition);
        
        const nodeId = testPath[nextStep];
        const mapping = coordinateMapping[nodeId];
        
        console.log(`🚶 Step ${nextStep + 1}: Moving to ${mapping.name}`);
        console.log(`📍 Position: ${newPosition.lat}, ${newPosition.lng}`);
        
        // Add test result
        const testResult = {
          step: nextStep + 1,
          nodeId,
          position: newPosition,
          mapping,
          timestamp: Date.now(),
          timeElapsed: Date.now() - startTimeRef.current
        };
        
        setTestResults(prev => [...prev, testResult]);
        
        onTestProgress?.({
          type: 'step',
          step: nextStep + 1,
          nodeId,
          position: newPosition,
          mapping
        });
        
        return nextStep;
      });
    }, 2000); // Fixed 2-second interval for better real-time testing
  };

  // Stop walking simulation
  const stopWalking = () => {
    setIsWalking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    console.log('⏹️ Path test stopped');
  };

  // Reset test
  const resetTest = () => {
    stopWalking();
    setCurrentStep(0);
    setCurrentPosition(null);
    setTestResults([]);
    console.log('🔄 Path test reset');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Don't render if not active
  if (!isActive) return null;

  return (
    <div>
      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        minWidth: '280px',
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflowY: 'auto',
        fontSize: '14px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Path Tester</h3>
        
        {/* Status */}
        <div style={{ marginBottom: '15px', padding: '10px', background: isWalking ? '#d4edda' : '#d1ecf1', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', color: isWalking ? '#155724' : '#0c5460' }}>
            {isWalking ? '🚶 Walking in Progress' : '📍 Ready to Test'}
          </div>
          <div style={{ fontSize: '12px', marginTop: '4px', color: isWalking ? '#155724' : '#0c5460' }}>
            Path: ENTRY → node1 → node2 → node8 → node24
          </div>
          {isWalking && (
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#155724' }}>
              Step: {currentStep + 1} / {testPath.length}
            </div>
          )}
        </div>

        {/* Test Info */}
        <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#495057' }}>
            <strong>⏱️ Test Speed:</strong> 2 seconds per step
          </div>
          <div style={{ fontSize: '12px', color: '#495057', marginTop: '4px' }}>
            <strong>🎯 Purpose:</strong> Simulate user movement to test location mapping
          </div>
        </div>

        {/* Control Buttons */}
        <div style={{ marginBottom: '15px' }}>
          {!isWalking ? (
            <button 
              onClick={startWalking}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              🚶 Start Walking Test
            </button>
          ) : (
            <button 
              onClick={stopWalking}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ⏹️ Stop Walking
            </button>
          )}
          
          <button 
            onClick={resetTest}
            disabled={isWalking}
            style={{
              background: isWalking ? '#6c757d' : '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: isWalking ? 'not-allowed' : 'pointer',
              width: '100%',
              fontSize: '12px',
              marginTop: '8px'
            }}
          >
            🔄 Reset Test
          </button>
        </div>

        {/* Current Position */}
        {currentPosition && (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#fff3cd', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', color: '#856404', marginBottom: '8px' }}>
              📍 Current Test Position:
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#856404' }}>
              {`{ lat: ${currentPosition.lat.toFixed(6)}, lng: ${currentPosition.lng.toFixed(6)} }`}
            </div>
            {currentStep < testPath.length && (
              <div style={{ fontSize: '12px', color: '#856404', marginTop: '4px' }}>
                Target: {coordinateMapping[testPath[currentStep]]?.name || testPath[currentStep]}
              </div>
            )}
          </div>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Test Results:</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
              {testResults.map((result, index) => (
                <div 
                  key={index}
                  style={{
                    padding: '6px 10px',
                    borderBottom: '1px solid #eee',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                    Step {result.step}: {result.mapping.name}
                  </div>
                  <div style={{ fontFamily: 'monospace', color: '#333', fontSize: '10px' }}>
                    {`{ lat: ${result.position.lat.toFixed(6)}, lng: ${result.position.lng.toFixed(6)} }`}
                  </div>
                  <div style={{ color: '#666', fontSize: '10px' }}>
                    Time: {result.timeElapsed}ms
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
          <strong>📱 Mobile Testing:</strong>
          <br />1. Enable "Location Mapper" toggle
          <br />2. Click "Start Walking Test" 
          <br />3. Watch red "T" marker move along path
          <br />4. Orange "S" markers show SVG positions
          <br />5. Perfect for testing on mobile devices!
          <br />
          <br /><strong>💡 Tip:</strong> Use real GPS on mobile for best results
        </div>
      </div>

      {/* Render test user marker */}
      {currentPosition && (
        <CircleMarker
          center={[currentPosition.lat, currentPosition.lng]}
          radius={8}
          pathOptions={{
            color: '#ff0000',
            fillColor: '#ff0000',
            fillOpacity: 0.8,
            weight: 3
          }}
        />
      )}
    </div>
  );
}
