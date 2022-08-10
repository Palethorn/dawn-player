function LicenseManager(_video_element, _la_url) {
    var self = this;
    this.video_element = _video_element;
    this.la_url = _la_url;
    this.in_progress = false;

    this.video_element.addEventListener('encrypted', function(e) {
        if(true == self.in_progress) {
            return;
        }

        self.in_progress = true;
        self.requestLicense(e);
    });

    this.config = [{
        initDataTypes: ['cenc'], 
        videoCapabilities: [{
                contentType: 'video/mp4; codecs="avc1.420015"',
                robustness: 'SW_SECURE_CRYPTO',
                encryptionScheme: 'cenc'
            },
            {
                contentType: 'video/mp4; codecs="avc1.4d001f"',
                robustness: 'SW_SECURE_CRYPTO',
                encryptionScheme: 'cenc'
            },
            {
                contentType: 'video/mp4; codecs="avc1.640028"',
                robustness: 'SW_SECURE_CRYPTO',
                encryptionScheme: 'cenc'
            },
            {
                contentType: 'video/mp4; codecs="avc1.640032"',
                robustness: 'SW_SECURE_CRYPTO',
                encryptionScheme: 'cenc'
            }
        ],
        audioCapabilities: [{
                contentType: 'audio/mp4; codecs="mp4a.40.2"',
                robustness: 'SW_SECURE_CRYPTO',
                encryptionScheme: 'cenc'
            }
        ]}
    ];

    this.requestLicense = function(e) {
        if (!this.video_element.mediaKeys) {
            navigator.requestMediaKeySystemAccess('com.widevine.alpha', this.config).then(function(keySystemAccess) {
                var promise = keySystemAccess.createMediaKeys();

                promise.catch(console.error.bind(console, 'Unable to create MediaKeys'));

                promise.then(function(createdMediaKeys) {
                    return self.video_element.setMediaKeys(createdMediaKeys);
                }).catch(console.error.bind(console, 'Unable to set MediaKeys'));

                promise.then(function(createdMediaKeys) {
                    var keySession = createdMediaKeys.createSession();
                    keySession.addEventListener('message', handleMessage, false);
                    // initData = self.parsePSSHList(e.initData)['edef8ba9-79d6-4ace-a3c8-27dcd51d21ed'];
                    return keySession.generateRequest('cenc', e.initData);
                }).catch(console.error.bind(console, 'Unable to create or initialize key session'));
            });
        }
    }

    function handleMessage(event) {
        console.log('handle message event');
        var keySession = event.target;
        
        var ajax = new Ajax();
        ajax.post({
            url: self.la_url.toString(),
            data: event.message,
            response_type: 'arraybuffer',
            success: function(response) {
                license = new Uint8Array(response);
                keySession.update(license).catch(console.error.bind(console, 'update() failed'));
                self.in_progress = false;
            }
        });
    }

    this.parsePSSHList = function(data) {
        if (data === null || data === undefined) {
            return [];
        }

        let dv = new DataView(data.buffer || data); // data.buffer first for Uint8Array support
        let done = false;
        let pssh = {};

        // TODO: Need to check every data read for end of buffer
        let byteCursor = 0;
        while (!done) {

            let size,
                nextBox,
                version,
                systemID;
            let boxStart = byteCursor;

            if (byteCursor >= dv.buffer.byteLength)
                break;

            /* Box size */
            size = dv.getUint32(byteCursor);
            nextBox = byteCursor + size;
            byteCursor += 4;

            /* Verify PSSH */
            if (dv.getUint32(byteCursor) !== 0x70737368) {
                byteCursor = nextBox;
                continue;
            }
            byteCursor += 4;

            /* Version must be 0 or 1 */
            version = dv.getUint8(byteCursor);
            if (version !== 0 && version !== 1) {
                byteCursor = nextBox;
                continue;
            }
            byteCursor++;

            byteCursor += 3; /* skip flags */

            // 16-byte UUID/SystemID
            systemID = '';
            let i, val;
            for (i = 0; i < 4; i++) {
                val = dv.getUint8(byteCursor + i).toString(16);
                systemID += (val.length === 1) ? '0' + val : val;
            }
            byteCursor += 4;
            systemID += '-';
            for (i = 0; i < 2; i++) {
                val = dv.getUint8(byteCursor + i).toString(16);
                systemID += (val.length === 1) ? '0' + val : val;
            }
            byteCursor += 2;
            systemID += '-';
            for (i = 0; i < 2; i++) {
                val = dv.getUint8(byteCursor + i).toString(16);
                systemID += (val.length === 1) ? '0' + val : val;
            }
            byteCursor += 2;
            systemID += '-';
            for (i = 0; i < 2; i++) {
                val = dv.getUint8(byteCursor + i).toString(16);
                systemID += (val.length === 1) ? '0' + val : val;
            }
            byteCursor += 2;
            systemID += '-';
            for (i = 0; i < 6; i++) {
                val = dv.getUint8(byteCursor + i).toString(16);
                systemID += (val.length === 1) ? '0' + val : val;
            }
            byteCursor += 6;

            systemID = systemID.toLowerCase();

            /* PSSH Data Size */
            byteCursor += 4;

            /* PSSH Data */
            pssh[systemID] = dv.buffer.slice(boxStart, nextBox);
            byteCursor = nextBox;
        }

        return pssh;
    }

    this.getPSSHData = function(pssh) {
        let offset = 8; // Box size and type fields
        let view = new DataView(pssh);

        // Read version
        let version = view.getUint8(offset);

        offset += 20; // Version (1), flags (3), system ID (16)

        if (version > 0) {
            offset += 4 + (16 * view.getUint32(offset)); // Key ID count (4) and All key IDs (16*count)
        }

        offset += 4; // Data size
        return pssh.slice(offset);
    }
}
