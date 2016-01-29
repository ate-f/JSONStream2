#! /usr/bin/env node

'use strict';

var Parser = require('jsonparse');
var through, check;

exports.parse = function(path, map) {

  var parser = new Parser();
  var stream = through(function(chunk) {
      if ('string' === typeof chunk) {
        chunk = new Buffer(chunk);
      }
      parser.write(chunk);
    },
    function(data) {
      if (data) {
        stream.write(data);
      }
      stream.queue(null);
    });

  if ('string' === typeof path) {
    path = path.split('.').map(
      function(e) {
        if (e === '*') {
          return true;
        } else if (e === '') { // '..'.split('.') returns an empty string
          return {
            recurse: true
          };
        } else {
          return e;
        }
      });
  }
  var count = 0,
      _key;

  if (!path || !path.length) {
    path = null;
  }

  parser.onValue = function(value) {
    if (!this.root) {
      stream.root = value;
    }

    if (!path) {
      return;
    }

    var pathIndex = 0; // iterates on path
    var stackIndex = 0; // iterates on stack
    while (pathIndex < path.length) {
      var key = path[pathIndex];
      var c;
      stackIndex++;

      if (key && !key.recurse) {
        c = (stackIndex === this.stack.length) ? this : this.stack[stackIndex];
        if (!c) {
          return;
        }
        if (!check(key, c.key)) {
          return;
        }
        pathIndex++;
      } else {
        pathIndex++;
        var nextKey = path[pathIndex];
        if (!nextKey) {
          return;
        }
        while (true) {
          c = (stackIndex === this.stack.length) ? this : this.stack[stackIndex];
          if (!c) {
            return;
          }
          if (check(nextKey, c.key)) {
            pathIndex++;
            this.stack[stackIndex].value = null;
            break;
          }
          stackIndex++;
        }
      }

    }
    if (stackIndex !== this.stack.length) {
      return;
    }

    count++;
    var actualPath = this.stack.slice(1).map(function(element) {
      return element.key;
    }).concat([this.key]);
    var data = this.value[this.key];
    data = map ? map(data, actualPath) : data;

    if (null !== (data)) {
      stream.queue(data);
    }
    delete this.value[this.key];
    for (var k in this.stack) {
      this.stack[k].value = null;
    }
  };
  parser._onToken = parser.onToken;

  parser.onToken = function(token, value) {
    parser._onToken(token, value);
    if (this.stack.length === 0) {
      if (stream.root) {
        if (!path) {
          stream.queue(stream.root);
        }
        count = 0;
        stream.root = null;
      }
    }
  };

  parser.onError = function(err) {
    if (err.message.indexOf("at position") > -1) {
      err.message = "Invalid JSON (" + err.message + ")";
    }
    stream.emit('error', err);
  };

  return stream;
};

/*function check(x, y) {
  if ('string' === typeof x) {
    return y == x;
  } else if (x && 'function' === typeof x.exec) {
    return x.exec(y);
  } else if ('boolean' === typeof x) {
    return x;
  } else if ('function' === typeof x) {
    return x(y);
  }
  return false;
}*/

exports.stringify = function(op, sep, cl, indent) {
  indent = indent || 0;
  if (op === false) {
    op = '';
    sep = '\n';
    cl = '';
  } else if (op === null) {

    op = '[\n';
    sep = '\n,\n';
    cl = '\n]\n';

  }

  var stream, first = true,
    anyData = false;
  stream = through(function(data) {
      anyData = true;
      var json = JSON.stringify(data, null, indent);
      if (first) {
        first = false;
        stream.queue(op + json);
      } else {
        stream.queue(sep + json);
      }
    },
    function(data) {
      if (!anyData) {
        stream.queue(op);
      }
      stream.queue(cl);
      stream.queue(null);
    });

  return stream;
};

exports.stringifyObject = function(op, sep, cl, indent) {
  indent = indent || 0;
  if (op === false) {
    op = '';
    sep = '\n';
    cl = '';
  } else if (op === null) {

    op = '{\n';
    sep = '\n,\n';
    cl = '\n}\n';

  }

  var first = true;
  var anyData = false;
  var stream = through(function(data) {
      anyData = true;
      var json = JSON.stringify(data[0]) + ':' + JSON.stringify(data[1], null, indent);
      if (first) {
        first = false;
        this.queue(op + json);
      } else {
        this.queue(sep + json);
      }
    },
    function(data) {
      if (!anyData) {
        this.queue(op);
      }
      this.queue(cl);

      this.queue(null);
    });

  return stream;
};
