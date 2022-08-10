function LoadTimer() {
    this.timestamp = null;
}

LoadTimer.prototype.start = function() {
    this.stop();
    this.timestamp = new Date().getTime();
};

LoadTimer.prototype.stop = function () {
    if (this.timestamp !== null) {
        var duration = (new Date().getTime()) - this.timestamp;
        this.timestamp = null;
        return duration;
    }
};