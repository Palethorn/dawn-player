function Player(_video_element, _url, _la_url) {
    var self = this;
    this.representations = {audio: {}, video: {}};
    this.stream_url = _url;
    this.video_element = _video_element;

    this.video_element.addEventListener('error', function(e) {
        console.log(e);
    });

    this.licenseManager = new LicenseManager(this.video_element, _la_url);

    var media_source = new MediaSource();
    this.video_source_buffer = null;
    this.audio_source_buffer = null;
    this.worker_interval = null;
    this.selected_audio_representation = null;
    this.selected_video_representation = null;
    this.audio_number = 0;
    this.video_number = 0;

    this.audio_chunklist = [];
    this.video_chunklist = [];

    this.download_init_segments = true;

    this.segmentTrack = {
        video: {
            startNumber: 0,
            currentNumber: 0,
            endNumber: 0
        },
        audio: {
            startNumber: 0,
            currentNumber: 0,
            endNumber: 0
        }
    }

    this.downloadInitSegments = function() {
        console.log('downloadInitSegments');
        console.log(self.selected_audio_representation.initialization);
        var audio_chunk_url = self.selected_audio_representation.initialization;
        var video_chunk_url = self.selected_video_representation.initialization;
        self.downloadChunk(video_chunk_url, 'video');
        self.downloadChunk(audio_chunk_url, 'audio');
    }

    this.downloadChunks = function() {
        console.log('downloadChunks');
        var audio_chunk_url = null;
        var video_chunk_url = null;

        while(self.segmentTrack.video.currentNumber < self.segmentTrack.video.endNumber) {
            video_chunk_url = self.selected_video_representation.media.replace('$Number$', self.segmentTrack.video.currentNumber);
            self.segmentTrack.video.currentNumber++;
            console.log("video chunk download");
            self.downloadChunk(video_chunk_url, 'video');
        }

        while(self.segmentTrack.audio.currentNumber < self.segmentTrack.audio.endNumber) {
            audio_chunk_url = self.selected_audio_representation.media.replace('$Number$', self.segmentTrack.audio.currentNumber);
            self.segmentTrack.audio.currentNumber++;
            console.log("audio chunk download");
            self.downloadChunk(audio_chunk_url, 'audio');
        }
    }

    this.downloadChunk = function(u, type) {
        var ajax = new Ajax();

        ajax.get({
            response_type: 'arraybuffer',
            url: u,
            
            success: function(response) {
                var chunk = new Uint8Array(response);

                self.queueChunk(chunk, type);
                self.appendToBuffer(type);
            }
        });
    }

    this.queueChunk = function(chunk, type) {
        if('audio' == type) {
            self.audio_chunklist.push(chunk);
        }

        if('video' == type) {
            self.video_chunklist.push(chunk);
        }
    }

    this.appendToBuffer = function(type) {
        if('video' == type) {
            self.appendToVideoBuffer();
        }

        if('audio' == type) {
            self.appendToAudioBuffer();
        }
    }

    this.appendToAudioBuffer = function() {
        if(!self.audio_source_buffer || self.audio_source_buffer.updating || self.audio_chunklist.length == 0) {
            return;
        }

        console.log('appendToAudioBuffer');
        self.audio_source_buffer.appendBuffer(self.audio_chunklist.shift());
    }

    this.appendToVideoBuffer = function() {
        if(!self.video_source_buffer || self.video_source_buffer.updating || self.video_chunklist.length == 0) {
            return;
        }

        console.log('appendToVideoBuffer');
        self.video_source_buffer.appendBuffer(self.video_chunklist.shift());
    }

    this.parseManifest = function(response) {
        var parser = new DOMParser();
        doc = parser.parseFromString(response, 'text/xml');
        var reps = doc.getElementsByTagName('Representation');
        var _baseUrl = self.stream_url.origin + self.getRelativeUrlPath();

        for(var i = 0; i < reps.length; i++) {
            var _type = '';
            var _mimeType = reps[i].getAttribute('mimeType');
            var _id = reps[i].getAttribute('id');
            var _codecs = reps[i].getAttribute('codecs');
            var _width = 0;
            var _height = 0;

            if('video/mp4' == _mimeType) {
                _type = 'video';
                _width = reps[i].getAttribute('codecs');
                _height = reps[i].getAttribute('height');
            }

            if('audio/mp4' == _mimeType) {
                _type = 'audio';
            }

            var _bitrate = reps[i].getAttribute('bandwidth');

            var _segmentTemplate = reps[i].getElementsByTagName('SegmentTemplate')[0];
            var _startNumber = parseInt(_segmentTemplate.getAttribute('startNumber'));
            var _initialization = _baseUrl + _segmentTemplate.getAttribute('initialization');
            var _media = _baseUrl + _segmentTemplate.getAttribute('media');

            if(_startNumber > self.segmentTrack[_type].startNumber) {
                self.segmentTrack[_type].startNumber = _startNumber;
                self.segmentTrack[_type].endNumber = self.segmentTrack[_type].startNumber + 6;

                if(0 == self.segmentTrack[_type].currentNumber) {
                    self.segmentTrack[_type].currentNumber = self.segmentTrack[_type].startNumber;
                }
            }

            if(!self.representations[_type][_bitrate]) {
                self.representations[_type][_bitrate] = {
                    id: _id,
                    type: _type,
                    media: _media,
                    width: _width,
                    height: _height,
                    codecs: _codecs,
                    bitrate: _bitrate,
                    mimeType: _mimeType,
                    initialization: _initialization
                };
            }
        }
    }

    this.selectRepresentations = function() {
        self.selected_audio_representation = self.representations.audio[128000];
        self.selected_video_representation = self.representations.video[500000];
    }

    this.initBuffers = function() {
        media_source.addEventListener('sourceopen', function(e) {
            console.log('sourceopen');

            self.video_source_buffer = media_source.addSourceBuffer('video/mp4; codecs="' + self.selected_video_representation.codecs + '"');
            self.video_source_buffer.mode = "sequence";
            self.video_source_buffer.addEventListener('error', function(e) {
                console.log(e);
            });

            self.audio_source_buffer = media_source.addSourceBuffer('audio/mp4; codecs="' + self.selected_audio_representation.codecs + '"');
            self.audio_source_buffer.mode = "sequence";

            self.audio_source_buffer.addEventListener('error', function(e) {
                console.log(e);
            });

            self.audio_source_buffer.addEventListener('updateend', function() {
                console.log("audio source buffer update end");
            }, false);
    
            self.video_source_buffer.addEventListener('updateend', function() {
                console.log("video source buffer update end");
            }, false);

            if(self.download_init_segments) {
                self.download_init_segments = false;
                self.downloadInitSegments();
            }

            self.downloadChunks();
        }, false);

        this.video_element.src = window.URL.createObjectURL(media_source);
    }

    this.getRelativeUrlPath = function() {
        var to = self.stream_url.pathname.lastIndexOf('/');
        to = to == -1 ? self.stream_url.pathname.length : to + 1;
        return self.stream_url.pathname.substring(0, to);
    }

    this.refreshManifest = function() {
        console.log(self.segmentTrack);

        var ajax = new Ajax();

        ajax.get({
            url: self.stream_url.toString(),
            success: function(response) {
                self.parseManifest(response);
                self.downloadChunks();
            }
        });
    }

    this.init = function() {
        var ajax = new Ajax();

        ajax.get({
            url: self.stream_url.toString(),
            success: function(response) {
                self.parseManifest(response);
                self.selectRepresentations();
                self.initBuffers();
                setInterval(self.refreshManifest, 5000);
            }
        });
    }
}
