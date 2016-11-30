'use strict';

const bleManager = Homey.wireless('ble');

let devices = new Map();
const SERVICE_CONTROL = 'f02adfc026e711e49edc0002a5d5c51b';
const SERIAL_NR = 'F0';
const SERVICE_MANUFACTURER = '1800';
const CHAR_SERIALNR = '2a00';
const CHAR_NAME = '2a00';


exports.init = function(devices, callback) {
    Homey.log('Initializing driver for Flic Button');


    devices.forEach(device => {
        add(device);
        console.log(device.id);

    });



    callback()
}


exports.pair = function(socket) {

    socket.on('list_devices', (data, callback) => {
        console.log('LIST DEVICES');
        bleManager.discover([], 5000, (err, advertisements) => {
            console.log('DISCOVER', advertisements.length);

            advertisements = advertisements || [];
            // Deze checked volgens mij naar bestaande devices / al gepairde devices
            advertisements = advertisements.filter(advertisement => !getDevice(advertisement.uuid));

            if (advertisements.length === 0) {
                return callback(null, []);
            }
            let failedCount = 0;
            advertisements.forEach(advertisement => {
                console.log('checking advertisement', advertisement.uuid, advertisement.serviceUuids);
                //console.log(advertisement);

                if (advertisement.serviceUuids.some(uuid => uuid === SERVICE_CONTROL)) {
                    console.log('connecting to', advertisement);
                    advertisement.connect((err, peripheral) => {
                        if (err) {
                            if (++failedCount === advertisements.length) {
                                console.log('called callback 1', failedCount, advertisements.length);
                                callback(null, []);
                            }
                            return;
                        }
                        peripheral.read(SERVICE_MANUFACTURER, CHAR_SERIALNR, (err, serialNumber) => {
                            console.log('serialnr', err, (serialNumber || '').toString());
                            if (err || (serialNumber || '').toString().indexOf(SERIAL_NR) !== 0) {
                                peripheral.disconnect();
                                if (++failedCount === advertisements.length) {
                                    console.log('called callback 2', failedCount, advertisements.length);
                                    callback(null, []);
                                }
                                return;
                            }
                            const deviceData = {
                                data: {
                                    id: peripheral.uuid,
                                },
                            };
                            peripheral.read(SERVICE_MANUFACTURER, CHAR_NAME, (err, name) => {
                                console.log('charname', err, name.toString());
                                peripheral.disconnect();
                                if (err) {
                                    if (++failedCount === advertisements.length) {
                                        console.log('called callback 3', failedCount, advertisements.length);
                                        callback(null, []);
                                    }
                                    return;
                                }
                                deviceData.name = name.toString();
                                if (callback) {
                                    console.log('RETURN CALLBACK', [deviceData]);
                                    callback(null, [deviceData]);
                                    callback = null;
                                } else {
                                    console.log('EMIT DEVICE', [deviceData]);
                                    socket.emit('list_devices', [deviceData]);
                                }
                            });
                        });
                    });
                } else if (++failedCount === advertisements.length) {
                    console.log('called callback 0', failedCount, advertisements.length);
                    callback(null, []);
                }

            });
        });
    });

    socket.on('add_device', (device) => {
        add(device.data);
    });

    socket.on('disconnect', () => {
        console.log('User aborted pairing, or pairing is finished');
    });



};

exports.deleted = function(device) {
    devices.delete(device.id);
};

function getDevice(device, includePairing) {
    const id = getDeviceId(device);
    if (devices.has(id)) {
        return devices.get(id);
    } else if (includePairing && pairingDevice && pairingDevice.data && pairingDevice.data.id === id) {
        return pairingDevice.data;
    }
    return null;
}

function getDeviceId(device) {
    if (device && device.constructor) {
        if (device.constructor.name === 'Object') {
            if (device.id) {
                return device.id;
            } else if (device.data && device.data.id) {
                return device.data.id;
            }
        } else if (device.constructor.name === 'String') {
            return device;
        }
    }
    return null;
}

function add(device) {
    device = device.data || device;
    const id = getDeviceId(device);
    devices.set(id, device);

}
