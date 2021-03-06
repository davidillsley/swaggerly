// --------------------------------------------------------------------------------------
//
var apiExplorer = { _apiKeys: {} };

apiExplorer.addApiKey = function(name,key) {
    this._apiKeys[name] = key;
}
apiExplorer.listApiKeys = function(){
    return Object.keys(this._apiKeys);
}
apiExplorer.getApiKey = function(name){
    return this._apiKeys[name];
}
apiExplorer.injectApiKeysIntoPage = function() {
    var select = document.getElementById("api-key-select");

    var names = this.listApiKeys();
    var len   = names.length;

    if( len == 0 ) {
        $('#api-key-select').hide();
        $('#api-key-input').show();
        return;
    } 

    $('#api-key-select').show();
    $('#api-key-input').hide();

    for (var i = 0; i < len; i++) {
        var option = document.createElement("option");
        option.text = names[i];
        option.setAttribute("value", this.getApiKey(option.text) );
        select.appendChild(option);
    }
};
apiExplorer.setBeforeSendCallback = function( func ) {
    this._extendCallback = func;
}

// Read the API get from the explorer input parameters.
apiExplorer.readApiKey = function() {
    return $('#api-key-select').val() || $('#api-key-input').val() || "";
};
apiExplorer.readAccessToken = function() {
    return $('#access-token-input').val() || "";
};

// --------------------------------------------------------------------------------------
var _process = function(text, status, xhr, fullhost) {
    var content = xhr.getResponseHeader('Content-Type');

    // Clean up previously opened result blocks
    $('#html_block').hide();
    $('#body_block').hide();

    if( content == null )
    {
        content = "text";
    }

    try {
        if( xhr.status == 0 )
        {
            $('#body_block').show();
            $('#response_body').text( "Failure while contacting API. Some possible causes are connection problems or cross-origin resource sharing protection. Please check javascript domains registered against APIKey / OAuth2 registration." );
        }
        else
        {
            if( content.match(/json/) )
            {
                $('#body_block').show();
                $('#response_body').html( hljs.highlight( 'json', JSON.stringify(JSON.parse(text), null, 2) ).value );

            } else if( content.match(/xml/) )
            {
                $('#body_block').show();
                $('#response_body').html( hljs.highlight( 'xml', text ).value );
            }
            else if( content.match(/html/) )
            {
                var iframe = $('#html_block')[0];
                var doc    = (iframe.contentWindow) ? iframe.contentWindow.document : iframe.contentDocument;

                text = text.replace( /<head>/mi, '<head><base href="//'+fullhost+'">');

                doc.open();
                doc.write( text );
                doc.close();

                $('#html_block').show();
            }
            else
            {
                $('#body_block').show();
                $('#response_body').html( hljs.highlightAuto( text ).value );
            }
        }
    }
    catch(err) {
        $('#body_block').show();
        $('#response_body').text( "Unexpected error: " + err.message + ' ' + err.line );
    }

    $('#results').show();
    $('#response').fadeIn().show();

    $('#response_code').text( xhr.status + ' ' + xhr.statusText );
    $('#response_headers').html( hljs.highlight( 'http', xhr.getAllResponseHeaders() ).value );

    $('#exploreButton').removeAttr('disabled');
}

// --------------------------------------------------------------------------------------

var _set_headers = function(request, headers ) {

    for( var i = 0; i < headers.length; i++ )
    {
        request.setRequestHeader( headers[i].name, headers[i].value );
    }
}

// --------------------------------------------------------------------------------------

var _get_header_text = function( headers ) {

    var text = '';

    for( var i = 0; i < headers.length; i++ )
    {
        text = text + '\n' + headers[i].name + ': ' + headers[i].value;
    }
    return text;
}

// --------------------------------------------------------------------------------------

var _get_url = function(url,query) {

    full_url = url + '?' + $.param(query);

    var urlp = document.createElement('a');
    urlp.href = url;
    // Make sure there is a leading / on the path
    urlp.pathname = urlp.pathname.replace(/(^\/?)/,"/");
    var port = '';
    if( urlp.port )
    {
        port = ':'+urlp.port;
    }

    return { fullUrl: full_url, fullhost:urlp.hostname + port, requestUrl: urlp.pathname + urlp.search };
};

// --------------------------------------------------------------------------------------
//
apiExplorer.go = function( method, url ){
    var query   = [];
    var form    = [];
    var body    = {};
    var headers = [];
    var gotjson = false;
    var errors  = [];
    var content_type = "";

    $('#apiexplorer :input').each( function() {
        var $input   = $(this);
        var type     = $input.data('type');
        var required = $input.attr('required');
        var val      = $input.val(); //.trim();
        var name     = $input.prop('name');

        $input.removeClass("errorfield");

        // Pick up any missing mandatory fields
        if( required && val == "" ) {
            errors.push( $input );
        }

        var obj = { "name":name, "value":val };

        if( type=='path' ) {
            url = url.replace('{'+name+'}', val);
        }
        if( type=='query' && val ) {
            query.push( obj );
        }
        if( type=='header' && val ) {
            headers.push( obj );
        }
        if( type=='form' && val ) {
            form.push( obj );
            //var fobj = {};
            //fobj[name] = val;
            //$.extend(body, fobj);
        }
        if( type=='body' && val ) {
            var fobj = {};
            fobj[name] = val;
            $.extend(body, fobj);
            gotjson = true;
        }
        if( type=='model' && val ) {
            // Parse might fail
            $.extend(body, JSON.parse(val));
            gotjson = true;
        }
    });


    // Handle errors
    if( errors.length ) {
        $.each( errors, function( index, value ) {
            // Target outer "group" with has-error class, as well as the input field. This gives a bit of flexibility
            $('#'+value.prop('name')+'-group').addClass("has-error");
            value.addClass("has-error");
            value.wiggle();
        });
        $('#results').hide();
        return;
    }

    var body_text;

    $('#request_body').hide();

    if( gotjson )
    {
        body_text = JSON.stringify(body, null, 2);

        // If we don't have an empty JSON document, display it
        if( body_text != '{}' ) {
            content_type = "\nContent-Type: application/json";
            $('#request_body').html( hljs.highlightAuto( body_text ).value );
            $('#request_body').show();

            // Replace body with JSON text
            body = body_text;
        }
    }
    else
    {
        if( form.length )
        {
            body_text = $.param(form);
            content_type = "\nContent-Type: application/x-www-form-urlencoded";
            $('#request_body').html( hljs.highlightAuto( body_text ).value );
            $('#request_body').show();

            // Replace body with url encoded data.
            // XXX This will only work if Ajax does not try to encode this
            // itself, thus ending up with a doubly-encoded param set.
            // This seems to be okay, looking in Chrome's console.
            body = body_text;
        }
    }

    // Create display headers and url before custom headers/queries are added, as these are internal.
    var display_headers = _get_header_text( headers );
    var display_url = _get_url(url, query).requestUrl;
    
    // Add internal queries and headers, if the extend callback is configured.
    // This allows authentication paramerters, for example, to be added to the request.
    if( this._extendCallback ) {
        var req = {};
        this._extendCallback(req); 

        if( req.headers ) {
            for( var p in req.headers ) {
                if( req.headers.hasOwnProperty(p) ) {
                    headers.push( { name: p, value:req.headers[p] } );
                }
            }
        }

        if( req.params ) {
            for( var p in req.params ) {
                if( req.params.hasOwnProperty(p) ) {
                    query.push( { name: p, value:req.params[p] } );
                }
            }
        }
    }

    // Construct request URL bits from the url and extended query
    var constructed_request = _get_url( url, query );

    // FIXME Get protocol from passed in url
    $('#request_url').html( hljs.highlight( 'http', method.toUpperCase() + ' ' + display_url + ' HTTP/1.1\nHost: ' + constructed_request.fullhost + content_type + display_headers ).value );

    $('#exploreButton').attr('disabled', 'disabled');

    $.support.cors = true;

    $.ajax({
        url: constructed_request.fullUrl,
        type: method,
        async: true,
        data: body,
        dataType: "text",
        success:  function( text, status, xhr)  { _process(text, status, xhr, constructed_request.fullhost) },
        error:    function( xhr,  status, text) { _process(xhr.responseText,  status, xhr, constructed_request.fullhost) },
        beforeSend: function( request ) {
            _set_headers( request, headers );
            $('#progress').stop(1,0).hide().delay(800).fadeIn();
            $('#response').stop(1,0).delay(10).hide();
        },
        complete:   function() { $('#progress').stop(1,0).hide(); }
    });
}
// --------------------------------------------------------------------------------------
