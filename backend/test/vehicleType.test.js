const assert = require('assert');
const { inferVehicleType } = require('../utils/vehicleType');

assert.strictEqual(inferVehicleType('Bike'), 'Bike');
assert.strictEqual(inferVehicleType('Electric Scooty 1'), 'Scooty');
assert.strictEqual(inferVehicleType('Petrol Scooty'), 'Scooty');
assert.strictEqual(inferVehicleType('Training Bike Pro'), 'Bike');
assert.strictEqual(inferVehicleType(''), 'Scooty');

console.log('vehicleType.test.js: OK');
