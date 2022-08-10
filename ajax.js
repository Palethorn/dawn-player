function Ajax() {
    this.get = function(options) {
        var xhttp = new XMLHttpRequest();
        self = this;

        if('response_type' in options) {
            xhttp.responseType = options.response_type;
        }

        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                options.success(this.response);
            }
        };

        xhttp.open("GET", options.url, true);
        xhttp.send();
    }

    this.post = function(options) {
        console.log(options)
        var xhttp = new XMLHttpRequest();
        self = this;

        if('response_type' in options) {
            xhttp.responseType = options.response_type;
        }

        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                options.success(this.response);
            }
        };

        xhttp.open("POST", options.url, true);
        xhttp.send(options.data);
    }
}