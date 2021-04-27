
var codeTextArea = document.getElementById("code");
var editor       = CodeMirror.fromTextArea(codeTextArea,
  { lineNumbers : true,
    matchBrackets : true
  }
);

var msgContainer = document.getElementById('message');
var resultContainer = document.getElementById("result");

var doc = editor.getDoc();

var examples = [
  "",
  "var h; h = true : H; \n\nvar l; \nl = false; \n\nif (h) { l = true; }",
  "var h; h = true : H; \n\nvar o; \no = {}; \n\nif (h) { o[\"x\"] = true; }",
  "var h; h = true : H; \n\nvar o; \no = { x : false }; \n\nif (h) { o[\"x\"] = true; }",
  "var h; h = true : H; \n\nvar x; \nvar o; \no = { y : false }; \n\nwith (o) { \n  if (h) { \n    x = true; \n    y = true; \n  } \n}",
  "var h; h = true : H; \n\nvar x; \nvar y; \nvar o; \no = { }; \n\nif (h) { \n  o[\"x\"] = false; \n}\n\nwith (o) {\n  x = true; \n  y = true;\n}",
  "var h; h = true : H; \n\nvar x; \n(function() {\n  if (h) {\n    return true;\n  }\n  x = 1; \n  return false;\n})();",
  "var h; h = true : H; \n\nvar mem;\nmem = function() {\n  var data;\n  return {\n    set : function(d) { data = d; },\n    get : function() { return data; }\n  };\n};\n\nvar x;\nx = mem();\nif (h) {\n  x[\"set\"](true); \n}",
  "var h; h = true : H; \n\nvar l;\n(function() {\n  if (h) {\n    eval(\"var l;\");\n  }\n  l = false;\n})();",
  "var h; h = true : H; \n\nvar o; \no = { f : true };\n\nif (h) {\n  o = { };\n}\n\no[\"f\"] = false;"
]

var desc = [
  "",
  "Example 1: Variable.",
  "Example 2: Absent property.",
  "Example 3: Present property.",
  "Example 4: 'with'",
  "Example 5: 'with' with secret structure and existence.",
  "Example 6: Return contexts.",
  "Example 7: One place buffer; function call. ",
  "Example 8: 'eval'. ",
  "Example 9: Update over secret pointer. (Results in security violation)"
]


var origContent = examples[1];
var origMsg     = "Press the 'Interpret!' button to interpret the program using the hybrid monitor.";

var exampleContainer = document.getElementById('examples');
for (var i = 1, len = examples.length; i < len; i++) {
  exampleContainer.appendChild(genExample(i));
}

doc.setValue(origContent);
msgContainer.textContent = origMsg;

// ---

function interpret() {
  var p = doc.getValue();
  var req = { program : p };

  $.ajax({
    type: 'POST',
      url: 'http://fierce-cliffs-4232.herokuapp.com/hybrid',
//      url: 'http://localhost:5000/hybrid',

    data: JSON.stringify(req),
    success: function (data) {
      visualize(data)
    },
    error: function() {
      msgContainer.textContent = 'Unable to contact interpreter service. Please inform the authors on d.hedin@gmail.com'
    },
    dataType: 'json'
  });
}

// ---

function visualize(res) {
  switch (res.type) {
    case "success" :
      var resultContainer = document.getElementById("result");
      resultContainer.hidden = false;

      var codeDiv = renderCode();
      var envDiv  = renderEnv(res.environment);

      var top = resultContainer.firstChild;

      resultContainer.insertBefore(codeDiv, top);
      resultContainer.insertBefore(envDiv, top);

      break;

    case "security error" :
      msgContainer.textContent = 'Security error: ' + res.message;

      break;

    case "type error" :
      msgContainer.textContent = 'Type error: ' + res.message;


      break;

    case "parse error" :
      msgContainer.textContent = 'Parse error: ' + res.message;

      break;
  }

}

// ---

function renderCode(target) {
  var div = document.createElement('div');
  div.className = 'code pure-u-md-1-2 pure-u-lg-1-3';

  var pre = document.createElement('pre');
  pre.textContent = doc.getValue();

  div.appendChild(pre);
  return div;
}

// ---

function renderEnv(env) {
  var div = document.createElement('div');
  div.className = 'pure-u-md-1-2 pure-u-lg-2-3';

  var scopes = [ env.scope ];
  var heap   = [];

  // for each object, collect scopes in closures in all properties.
  for (var x in env.heap) {
    var obj = env.heap[x]
    heap[Number(x)] = obj;

    for (var y in obj.data) {
      var prop = obj.data[y];
      var val  = prop.content.value;
      if (val !== null && typeof val === 'object' && val.type === 'closure') {
        scopes.push(val.scope);
      }
    }
  }

  // add scopes to heap - scope ids do not overlap with pointers
  for (var i = 0, len = scopes.length; i < len; i++) {
    var scope = scopes[i];
    while (scope !== null) {
      var id = scope.id;
      if (heap[id] === undefined) {
        heap[id] = mkObject(scope);
      }

      scope = scope.parent;
    }
  }

  // render heap
  for (var i = 0, len = heap.length; i < len; i++) {
    if (heap[i] !== undefined) {
      renderObject(div, i, heap[i]);
    }
  }

  return div;
}

// ---

function mkObject(scope) {

  var parent = scope.parent === null ? 'null' : '@' + scope.parent.id;

  var obj = { structure: 'Low',
              isscope : true,
              info : scope.info,
              data : {
                parent: { exist: 'Low', content: { label: 'Low', value: parent } },
                envrec: { exist: 'Low', content: scope.envrec }
            }
  }

  return obj;
}

// ---

function renderObject(target, ptr, obj) {

  // the object
  var div = document.createElement('div');
  var designator = obj.isscope ? 'scope object' : 'object';
  if (obj.structure === 'Low') {
    div.className = designator;
  } else {
    div.className = 'secret ' + designator;
  }

  // the pointer
  var pointer = document.createElement('div');
  pointer.className = 'pointer';
  pointer.textContent = obj.info.desc + ' (' + obj.info.line + ', ' + obj.info.col + ') @' +  ptr;

  // the property, and value column
  var lcol = document.createElement('div');
  lcol.className = 'column';
  var rcol = document.createElement('div');
  rcol.className = 'column';

  for (var x in obj.data) {
    var prop = obj.data[x];

    // the property
    var pname = document.createElement('div');
    pname.textContent = x;

    if (prop.exist === 'Low') {
      pname.className = 'part';
    } else {
      pname.className = 'secret part';
    }

    // the value
    var pval = document.createElement('div');
    var val = prop.content.value;
    if (val !== null && typeof val === 'object' && val.type === 'closure') {
      pval.textContent = val.info.desc + ' (' + val.info.line + ', ' + val.info.col + ') @' + val.scope.id;
    } else {
      pval.textContent = String(val);
    }

    if (prop.content.label === 'Low') {
      pval.className = 'part';
    } else {
      pval.className = 'secret part';
    }

    lcol.appendChild(pname);
    rcol.appendChild(pval);

  }

  div.appendChild(pointer);
  div.appendChild(lcol);
  div.appendChild(rcol);

  target.appendChild(div);
}


// ---

function genScope(scope) {
  var el = document.createElement('span');
  el.className = 'pure-button entity'

  if (scope.parent !== null) {
    el.appendChild(genScope(scope.parent))
    el.appendChild(document.createTextNode(' , '));
  }

  el.appendChild(document.createTextNode(scope.envrec));
  return el;
}

// ---

function genLabel(text) {
  var labelDiv = document.createElement('div');
  labelDiv.className = 'l-box pure-u-1 pure-u-md-1-2 pure-u-lg-1-8';

  var labelSpan = document.createElement('span');
  labelSpan.textContent = text;
  labelDiv.appendChild(labelSpan);

  return labelDiv;
}

// ---

function genBubble(text) {
  var el = document.createElement('span');
  el.className = 'pure-button entity'
  el.textContent = text;
  return el;
}

// ---

function genExample(n) {
  var exDiv = document.createElement('div');
  exDiv.onmouseover = function() { displayExample(n); };
  exDiv.onmouseout  = resetContent;
  exDiv.onclick     = function() { setExample(n); };

  var icon = document.createElement('i');
  icon.className = 'fa fa-th-large';

  exDiv.appendChild(icon);
  exDiv.appendChild(document.createTextNode(' Example ' + n));
  return exDiv;
}

// ---

function displayExample(n) {
  origContent = doc.getValue();
  origMsg     = msgContainer.textContent;
  doc.setValue(examples[n]);

  msgContainer.textContent = desc[n];
}

// ---

function setExample(n) {
  origContent = examples[n];
  origMsg     = desc[n];
}

// ---

function resetContent() {
  doc.setValue(origContent);
  msgContainer.textContent = origMsg;
}

