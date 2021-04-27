
var codeTextArea = document.getElementById("code");
var editor       = CodeMirror.fromTextArea(codeTextArea,
  { lineNumbers : true,
    matchBrackets : true,
    mode: "python"
  }
);


var msgContainer = document.getElementById('message');
var resultContainer = document.getElementById("result");

var doc = editor.getDoc();

var examples = [
  "x = 2 | top # A confidential number 2\ny = 3;      # A public number 3\n\nw = z = 5 + x     # Explicit flow\n\nif x == 2: z = 2  # Implicit flow\n\n#upgrades a variable\nstr = 'string' ^ top\n# upgrades the type\nint = 1 | top\n# record\nrec1 = {'i': int } ^ top\n# upgrade the existence\nrec2 = {'i': 1   } & top",
  "t = 1 ^ top\nh = true ^ top\n\nif h:\n  t = 2\nelse:\n  t = 3\n\nl=type(t)",
  "t = 1 ^ top\nh = true ^ top\no = {\"x\":t} ^ top\n\nif h:\n  o[\"x\"] = 0\n\nl = \"x\" in o",
  "h = true ^ top\no = {}^top\n\nif h :\n  o['x'] = 0\n\ndel o['x']\nl = 'x' in o",
  "h = {\"x\":1,\"y\": \"value\"}\nf = \"x\" ^ top\nh[f]=1",
  "t = 1 ^ top\nh = {\"x\":t,\"y\": \"value\"}\ny = \"x\" ^ top\nh[y] = 2"
]

var desc = [
  "Example 0: Explict and implicit flows.",
  "Example 1: lst 1.2",
  "Example 2: lst 1.4",
  "Example 3: lst 1.6",
  "Example 4: Update a top field in a record.",
  "Example 5: The existance is bot"
]


var origContent = examples[0];
var origMsg     = "Press the 'Run with VS' button or 'Run without VS' button to interpret the program using a value-sensitivity monitor or a traditional non-sensitive upgrade monitor.";

var exampleContainer = document.getElementById('examples');
for (var i = 0, len = examples.length; i < len; i++) {
  exampleContainer.appendChild(genExample(i));
}

doc.setValue(origContent);
msgContainer.textContent = origMsg;

// ---

function interpret(monitor) {
  var p = doc.getValue();
  var req = { program : p };

  var buttom = $(".interpret"+monitor).removeClass();
  buttom.removeClass();
  buttom.addClass('fa fa-cog fa-spin interpret'+monitor);

  $.ajax({
    type: 'POST',
    url: 'http://valsens.herokuapp.com/interpret'+monitor,
    /* url: 'http://localhost:8080/interpret'+monitor, */
    data: JSON.stringify(req),
    success: function (data) {
      visualize(data); 
      buttom.removeClass();
      buttom.addClass('fa fa-cog interpret'+monitor);
    },
    error: function() {
      msgContainer.textContent = 'Unable to contact interpreter service. Please inform the authors on bello -at- chalmers.se'
      buttom.removeClass();
      buttom.addClass('fa fa-cog interpret'+monitor);
    },
    dataType: 'json'
  });
}

// ---

function visualize(res) {

  msgContainer.innerHTML = '<b>Execution successfully completed:</b> The resulting heap is printed below. Red means top labeled.';
  switch (res.type) {
    case "securityError" :
      msgContainer.innerHTML = '<b>'+res.error+':</b> ' + res.message +" in "+ res.line +":"+res.offset;
    case "success" :
      var resultContainer = document.getElementById("result");
      resultContainer.hidden = false;

      var codeDiv = renderCode(res);
      var envDiv  = renderEnv(res.S,res.monitor,res.type);

      var top = resultContainer.firstChild;

      resultContainer.insertBefore(codeDiv, top);
      resultContainer.insertBefore(envDiv, top);

      location.hash = "#result";

      break;

    case "error" :
      msgContainer.innerHTML = '<b>'+res.error+':</b> ' + res.message +" in "+ res.line +":"+res.offset;
      break;
  }

}

// ---

function renderCode(res) {
  var div = document.createElement('div');
  div.className = 'code pure-u-md-1-2 pure-u-lg-1-3';

  var pre = document.createElement('pre');
  pre.className='preResult';
  pre.textContent = doc.getValue();
  if (res.type == "securityError" ){ pre.textContent += "\n\n"+res.message +" in "+ res.line +":"+res.offset;}
  div.appendChild(pre);
  return div;
}

// ---

function renderEnv(env,monitor,type) {
  var div = document.createElement('div');
  div.className = 'pure-u-md-1-2 pure-u-lg-2-3';

  var divMonitor = document.createElement('div');
  divMonitor.className = 'monitor pure-u-md-1-1 pure-u-lg-1-1';
  if (type == "securityError" ){ divMonitor.className+= " error"}
  if (monitor == 'NSU') divMonitor.textContent='No Sensitive Upgrade Monitor';
  else divMonitor.textContent='Value-Sensitive Monitor';
  div.appendChild(divMonitor);

  // for each variable, collect scopes in closures in all properties.
  for (var x in env) {
    var v = env[x];

    switch (v[2]) { //Type
    case "record" :
       renderRecord(div, x, v);
       break;
    default:
       renderValue(div, x, v);
    }


  }
  return div;
}

// ---

function _(tag, clazz, content) {
  var myElement = document.createElement(tag);
  if (typeof clazz != 'undefined') {
      myElement.className = clazz;
      if (typeof content != 'undefined') {
      myElement.appendChild(document.createTextNode(content));
      }
  }
  return myElement;
}

function renderRecord(target, name, value) {

  var valueDiv = _('div','labeledValue');
  target.appendChild(valueDiv);

  var fields =_('div','recordValue ' + value[1]);
  for (var x in value[0]) {
        renderValue(fields, x, value[0][x][0],value[0][x][1][1]);
  }

  valueDiv.appendChild(_('div','recordName',name +" : "));
  valueDiv.appendChild(fields);
  valueDiv.appendChild(_('div','recordType '  + value[3] ,value[2]));
  return valueDiv;  
}

function renderField(target, name, value) {
  var fieldDiv = _('div','fieldValue');
  target.appendChild(fieldDiv);
  alert(value);

  fieldDiv.appendChild(_('div','fieldName',name +" : "));
  fieldDiv.appendChild(_('div','fieldValue ' + value[1] ,value[0]));
  fieldDiv.appendChild(_('div','fieldType '  + value[3] ,value[2]));

  return fieldDiv;
}


function renderValue(target, name, value, existancel) {
  if( typeof existancel === 'undefined' ) {
    existancel = ""
  }

  var valueDiv = _('div','labeledValue '+existancel);
  target.appendChild(valueDiv);

  valueDiv.appendChild(_('div','variableName '+existancel ,name +" : "));
  valueDiv.appendChild(_('div','variableValue ' + value[1] ,value[0]));
  valueDiv.appendChild(_('div','variableType '  + value[3] ,value[2]));
  return valueDiv;  
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

