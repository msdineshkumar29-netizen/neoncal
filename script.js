/* Advanced calculator logic using shunting-yard + RPN evaluation */
(() => {
  const exprEl = document.getElementById('expr');
  const resultEl = document.getElementById('result');
  const buttons = document.querySelectorAll('.glass-btn');
  const info = document.getElementById('info');
  const toggleDeg = document.getElementById('toggle-deg');

  let memory = 0;
  let angleMode = 'rad'; // or 'deg'
  let current = '';

  function updateDisplay(){
    exprEl.textContent = current || '0';
    try{
      const val = evaluateExpression(current || '0');
      resultEl.textContent = Number.isFinite(val) ? formatResult(val) : 'Error';
    } catch(e){
      resultEl.textContent = '';
    }
  }

  function formatResult(n){
    const str = (Math.abs(n) < 1e-12 ? 0 : n).toPrecision(12);
    // remove trailing zeros
    return parseFloat(str).toString();
  }

  // Tokenize
  function tokenize(s){
    const tokens = [];
    let i=0;
    while(i<s.length){
      const ch = s[i];
      if(/\s/.test(ch)){ i++; continue; }
      if(/[0-9.]/.test(ch)){
        let num = ch; i++;
        while(i<s.length && /[0-9.]/.test(s[i])){num+=s[i++];}
        tokens.push({type:'number', value:parseFloat(num)});
        continue;
      }
      if(/[a-zA-Zπe]/.test(ch)){
        let name = ch; i++;
        while(i<s.length && /[a-zA-Z0-9_]/.test(s[i])) name+=s[i++];
        tokens.push({type:'name', value:name});
        continue;
      }
      // operators and parentheses
      if('+-*/^(),%!'.includes(ch)){
        tokens.push({type:'op', value:ch}); i++; continue;
      }
      // unknown char -- skip
      i++;
    }
    return tokens;
  }

  const operators = {
    '+':{prec:2, assoc:'L', args:2, fn:(a,b)=>a+b},
    '-':{prec:2, assoc:'L', args:2, fn:(a,b)=>a-b},
    '*':{prec:3, assoc:'L', args:2, fn:(a,b)=>a*b},
    '/':{prec:3, assoc:'L', args:2, fn:(a,b)=>a/b},
    '^':{prec:4, assoc:'R', args:2, fn:(a,b)=>Math.pow(a,b)},
    '%':{prec:3, assoc:'L', args:1, fn:(a)=>a/100},
    '!':{prec:5, assoc:'L', args:1, fn:fact},
  };

  const functionsMap = {
    'sin': (x)=> angleMode==='deg' ? Math.sin(x*Math.PI/180) : Math.sin(x),
    'cos': (x)=> angleMode==='deg' ? Math.cos(x*Math.PI/180) : Math.cos(x),
    'tan': (x)=> angleMode==='deg' ? Math.tan(x*Math.PI/180) : Math.tan(x),
    'ln': (x)=>Math.log(x),
    'log': (x)=>Math.log10 ? Math.log10(x) : Math.log(x)/Math.LN10,
    'sqrt': (x)=>Math.sqrt(x),
    'pi': ()=>Math.PI,
    'e': ()=>Math.E
  };

  function fact(n){
    if(n<0) return NaN;
    if(Math.floor(n)!==n) return NaN;
    let r=1; for(let i=2;i<=n;i++) r*=i; return r;
  }

  function shuntingYard(tokens){
    const out=[]; const stack=[];
    for(let i=0;i<tokens.length;i++){
      const t = tokens[i];
      if(t.type==='number') out.push(t);
      else if(t.type==='name'){
        // function or constant
        // if next token is '(', it's a function
        if(tokens[i+1] && tokens[i+1].value==='(') { stack.push(t); }
        else out.push(t);
      } else if(t.type==='op'){
        const v = t.value;
        if(v==='('){ stack.push(t); }
        else if(v===')'){
          while(stack.length && stack[stack.length-1].value!=='(') out.push(stack.pop());
          stack.pop(); // pop '('
          if(stack.length && stack[stack.length-1].type==='name') out.push(stack.pop());
        } else {
          const op1 = v;
          const o1 = operators[op1] || null;
          while(stack.length){
            const top = stack[stack.length-1];
            if(top.type==='op'){
              const op2 = top.value; const o2 = operators[op2];
              if(o2 && ((o1 && o1.assoc==='L' && o1.prec<=o2.prec) || (o1 && o1.assoc==='R' && o1.prec<o2.prec))){ out.push(stack.pop()); continue; }
            }
            break;
          }
          stack.push(t);
        }
      }
    }
    while(stack.length) out.push(stack.pop());
    return out;
  }

  function evaluateRPN(rpn){
    const st=[];
    for(const t of rpn){
      if(t.type==='number') st.push(t.value);
      else if(t.type==='name'){
        const name = t.value.toLowerCase();
        if(functionsMap[name]){
          const res = functionsMap[name]();
          st.push(res);
        } else {
          // treat unknown name as 0
          st.push(0);
        }
      } else if(t.type==='op'){
        const op = t.value;
        if(op === '%'){
          const a = st.pop(); st.push(operators['%'].fn(a));
        } else if(op === '!'){
          const a = st.pop(); st.push(operators['!'].fn(a));
        } else {
          const b = st.pop(); const a = st.pop();
          const fn = operators[op].fn; st.push(fn(a,b));
        }
      }
    }
    return st.pop();
  }

  function evaluateExpression(s){
    if(!s) return 0;
    // preprocess: replace unicode minus, multiply, divide
    s = s.replace(/×/g,'*').replace(/÷/g,'/').replace(/×/g,'*').replace(/–/g,'-');
    // Insert implicit multiplication: between number/closing ')' and name/opening '('
    s = s.replace(/(\d|\))(?=\()/g,'$1*');
    // Tokenize
    const tokens = tokenize(s);
    // Convert names 'pi' and 'e' into name tokens already handled
    const rpn = shuntingYard(tokens);
    return evaluateRPN(rpn);
  }

  // Button actions
  buttons.forEach(b => b.addEventListener('click', ()=>{
    const val = b.getAttribute('data-value');
    const action = b.getAttribute('data-action');
    if(action){
      handleAction(action); return;
    }
    if(val){
      handleInput(val);
    }
  }));

  function handleAction(action){
    if(action==='mc'){ memory = 0; info.textContent='Memory cleared'; }
    else if(action==='mr'){ current += memory.toString(); info.textContent='Memory recalled'; updateDisplay(); }
    else if(action==='mplus'){ memory += Number(evaluateExpression(current||'0')||0); info.textContent='M+'; }
    else if(action==='mminus'){ memory -= Number(evaluateExpression(current||'0')||0); info.textContent='M-'; }
    else if(action==='percent'){ current += '%'; }
    else if(action==='negate'){ current = negateLastNumber(current); }
    else if(action==='clear'){ current=''; }
    else if(action==='back'){ current = current.slice(0,-1); }
    else if(action==='mc' || action==='mr'){}
    updateDisplay();
  }

  function negateLastNumber(s){
    // simple approach: find last number and negate
    const m = s.match(/(.*?)(-?\d*\.?\d+)$/);
    if(!m) return s;
    return m[1] + (parseFloat(m[2])? (-parseFloat(m[2])) : '0');
  }

  function handleInput(val){
    if(val==='='){
      try{ const v = evaluateExpression(current); current = String(Number.isFinite(v)? formatResult(v): ''); info.textContent='Evaluated'; } catch(e){ info.textContent='Error'; }
    } else if(val==='back'){ current = current.slice(0,-1); }
    else if(val==='pi'){ current += 'pi'; }
    else if(val==='e'){ current += 'e'; }
    else if(['sin','cos','tan','ln','log','sqrt'].includes(val)){
      current += val + '(';
    } else if(val==='factorial'){ current += '!'; }
    else current += val;
    updateDisplay();
  }

  // clear-all button
  document.getElementById('clear-all').addEventListener('click', ()=>{ current=''; updateDisplay(); info.textContent='Cleared'; });

  toggleDeg.addEventListener('click', ()=>{ angleMode = angleMode==='rad'?'deg':'rad'; toggleDeg.textContent = angleMode==='rad'?'RAD':'DEG'; info.textContent = 'Mode: '+angleMode; });

  // keyboard support
  window.addEventListener('keydown', (e)=>{
    const key = e.key;
    if(/[0-9]/.test(key)) handleInput(key);
    else if(key==='Enter' || key==='=') handleInput('=');
    else if(key==='Backspace') current = current.slice(0,-1);
    else if(key==='Escape') current='';
    else if(key==='.') handleInput('.');
    else if(key==='(' || key===')') handleInput(key);
    else if(key==='+'||key==='-'||key==='*'||key==='/'||key==='^') handleInput(key);
    updateDisplay();
  });

  // initial render
  updateDisplay();
})();