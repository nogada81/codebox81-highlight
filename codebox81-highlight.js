(() => {
	"use strict";
  /* =========================================================================
   MicroHighlighter — HTML/CSS/JS (VS Code 환경용)
   - HTML 코드블럭 내부 <style>/<script> → 각 하이라이터에 위임
   - CSS/JS 단독 블럭도 인식 (속성 키: class, data-*, 등)
   - 이스케이프/정규식 백슬래시 검토 완료
   ========================================================================= */
  /* ───────────── 설정 ───────────── */
  const ATTR_KEYS = [
    "class","data-ke-language","data-language","data-lang",
    "data-ext","data-filename","data-file","data-path",
    "data-name","data-title"
  ];

  const CPP_MARKERS = new Set([
    "language-c","lang-c","c",
    "language-cpp","lang-cpp","cpp",
    "language-c++","lang-c++","c++",
  ]);

  const HTML_MARKERS = new Set([
    "language-html","language-xml","language-xhtml","language-markup",
    "html","xml","xhtml","markup","htm"
  ]);

  const CSS_MARKERS = new Set([
    "language-css","css"
  ]);
  
  const JS_MARKERS  = new Set([
    "language-javascript","language-java","language-js",
    "javascript","java","js","mjs","cjs"
  ]);

  const KEYWORDS_JS = new Set((
    "break case catch class const continue debugger default delete do else export extends "+
    "finally for function if import in instanceof let new return super switch this throw "+
    "try typeof var void while with yield await enum implements interface package private "+
    "protected public static as from of"
  ).split(/\s+/));
  const WHITES = /\s/;

  /* ───────────── 유틸 ───────────── */
  function escapeHtml(str){
    return str.replace(/[&<>"']/g, c =>
      c === "&" ? "&amp;" :
      c === "<" ? "&lt;"  :
      c === ">" ? "&gt;"  :
      c === '"' ? "&quot;": "&#39;"
    );
  }
  function attrHints(el){
    let s = "";
    for(const k of ATTR_KEYS){
      const v = el.getAttribute && el.getAttribute(k);
      if(v) s += " " + String(v).toLowerCase();
    }
    return s;
  }
  function detectLang(pre, code){
    const hint = (attrHints(pre)+" "+attrHints(code)).toLowerCase();
    for(const k of HTML_MARKERS){ if(hint.includes(k)) return "html"; }
    for(const k of CSS_MARKERS){  if(hint.includes(k))  return "css"; }
    for(const k of JS_MARKERS){   if(hint.includes(k))   return "js"; }
    for(const k of CPP_MARKERS){  if(hint.includes(k))  return "cpp"; }
    return null;
  }
  function batched(list, fn, batch=10){
    let i=0;
    function step(){
      let n=0;
      while(i<list.length && n<batch){ fn(list[i++]); n++; }
      if(i<list.length) setTimeout(step,0);
    }
    setTimeout(step,0);
  }

  /* ───────────── HTML 하이라이터 ───────────── */
  function highlightHTML(src){
    let i=0, out="", n=src.length;
    const until = token => {
      const idx = src.indexOf(token, i);
      const j = idx === -1 ? n : idx + token.length;
      const seg = src.slice(i, j); i = j; return seg;
    };

    function paintAttrs(attrs){
      let s = attrs, outA = "";
      // 공백/슬래시 + 속성 name[=value]
      const re = /([\s\/]+)|([:@A-Za-z_][\w:.-]*)(\s*=\s*)?("([^"]*)"|'([^']*)'|[^\s"'=<>`]+)?/g;
      let m;
      while((m = re.exec(s))){
        if(m[1]){ outA += escapeHtml(m[1]); continue; }
        const name = m[2], eq = m[3]||"", val = m[4]||"";
        if(name) outA += '<span class="token html-attr">'+escapeHtml(name)+'</span>';
        if(eq)   outA += '<span class="token html-attr-eq">'+escapeHtml(eq)+'</span>';
        if(val){
          if(val.startsWith('"')){
            outA += '"<span class="token html-attr-val">'+escapeHtml(val.slice(1,-1))+'</span>"';
          }else if(val.startsWith("'")){
            outA += '\'<span class="token html-attr-val">'+escapeHtml(val.slice(1,-1))+'</span>\'';
          }else{
            outA += '<span class="token html-attr-val">'+escapeHtml(val)+'</span>';
          }
        }
      }
      return outA;
    }

function paintOpenCloseTag(raw, startIndex){
	const m = raw.match(/^<\s*(\/)?\s*([A-Za-z][\w:-]*)/);
	const isClose = !!(m && m[1]);
	const name = m ? m[2] : "";
	const head = raw.includes(">") ? raw.slice(0, raw.indexOf(">")) : raw;

	if(isClose){
		return {
			html: '<span class="token html-tag">&lt;/</span>' +
			      '<span class="token html-name">'+escapeHtml(name)+'</span>' +
			      '<span class="token html-tag">&gt;</span>',
			nextI: startIndex + raw.length
		};
	}

	const attrsPart = head.replace(/^<\s*\/?\s*[A-Za-z][\w:-]*/, "");
	const open = '<span class="token html-tag">&lt;</span>'+
	             '<span class="token html-name">'+escapeHtml(name)+'</span>';
	const attrs = paintAttrs(attrsPart);
	const selfClose = /\/\s*>$/.test(raw);
	const tail = selfClose
		? '<span class="token html-tag"> /&gt;</span>'
		: '<span class="token html-tag">&gt;</span>';

	// Delegate inner of <style> / <script> without mutating outer "i"
	if(!isClose){
		// <style> ... </style>
		if(/^<\s*style\b/i.test(raw)){
			const innerStart = startIndex + raw.length;
			const closeIdx = src.indexOf("</style>", innerStart);
			if(closeIdx !== -1){
				const innerContent = src.substring(innerStart, closeIdx);
				const painted = paintStyleInner(head, innerContent);
				const closePainted =
					'<span class="token html-tag">&lt;/</span><span class="token html-name">style</span><span class="token html-tag">&gt;</span>';
				return { html: open+attrs+tail + painted + closePainted, nextI: closeIdx + 8 };
			}
		}
		// <script> ... </script>
		if(/^<\s*script\b/i.test(raw)){
			const innerStart = startIndex + raw.length;
			const closeIdx = src.indexOf("</script>", innerStart);
			if(closeIdx !== -1){
				const innerContent = src.substring(innerStart, closeIdx);
				const painted = paintScriptInner(head, innerContent);
				const closePainted =
					'<span class="token html-tag">&lt;/</span><span class="token html-name">script</span><span class="token html-tag">&gt;</span>';
				return { html: open+attrs+tail + painted + closePainted, nextI: closeIdx + 9 };
			}
		}
	}

	return { html: open+attrs+tail, nextI: startIndex + raw.length };
}

    function paintStyleInner(openHead, content){
      const lower = openHead.toLowerCase();
      const noType = !/type\s*=/.test(lower);
      const ok = noType || /type\s*=\s*["']?\s*text\/css\s*["']?/.test(lower);
      return ok ? highlightCSS(content) : escapeHtml(content);
    }
    function paintScriptInner(openHead, content){
      const lower = openHead.toLowerCase();
      const hasTypeOrLang = /(?:type|language)\s*=/.test(lower);
      const jsOk = /type\s*=\s*["']?\s*text\/javascript\s*["']?/.test(lower) ||
                   /language\s*=\s*["']?\s*javascript\s*["']?/.test(lower) ||
                   /type\s*=\s*["']?\s*module\s*["']?/.test(lower);
      const ok = !hasTypeOrLang || jsOk; // 미지정도 JS로 간주
      return ok ? highlightJS(content) : escapeHtml(content);
    }

    while(i<n){
      if(src.startsWith("<!--", i)){
        const seg = until("-->");
        out += '<span class="token comment">'+escapeHtml(seg)+'</span>';
        continue;
      }
      if(/^<!DOCTYPE/i.test(src.slice(i))){
        const seg = until(">");
        out += '<span class="token html-doctype">'+escapeHtml(seg)+'</span>';
        continue;
      }
      if(src.startsWith("<![CDATA[", i)){
        const seg = until("]]>");
        out += '<span class="token html-cdata">'+escapeHtml(seg)+'</span>';
        continue;
      }
      if(src[i] === "<"){
        const m = src.slice(i).match(/^<\s*\/?\s*[A-Za-z][\w:-]*[\s\S]*?>/);
        if(m){ const r = paintOpenCloseTag(m[0], i); out += r.html; i = r.nextI; continue; }
        out += "&lt;"; i++; continue;
      }
      const j = src.indexOf("<", i);
      const end = j === -1 ? n : j;
      out += escapeHtml(src.slice(i, end)); i = end;
    }
    return out;
  }

  /* ───────────── CSS 하이라이터 ───────────── */
  function highlightCSS(src){
    let i=0, out="", n=src.length;

    function comment(){
      const j = src.indexOf("*/", i+2);
      const end = j === -1 ? n : j+2;
      out += '<span class="token comment">'+escapeHtml(src.slice(i,end))+'</span>'; i=end;
    }
    function str(q){
      let j=i+1, esc=false;
      for(; j<n; j++){
        const c = src[j];
        if(esc){ esc=false; continue; }
        if(c === "\\"){ esc=true; continue; }
        if(c === q){ j++; break; }
      }
      out += '<span class="token css-value">'+escapeHtml(src.slice(i,j))+'</span>'; i=j;
    }
    function selector(){
      let s=i;
      while(i<n){
        const c=src[i];
        if(c==="{") break;
        if(c==="/"&&src[i+1]==="*"){ out+='<span class="token css-selector">'+escapeHtml(src.slice(s,i))+'</span>'; comment(); s=i; continue; }
        if(c==='"'||c==="'"){ out+='<span class="token css-selector">'+escapeHtml(src.slice(s,i))+'</span>'; str(c); s=i; continue; }
        i++;
      }
      if(s<i) out+='<span class="token css-selector">'+escapeHtml(src.slice(s,i))+'</span>';
    }
    function paintValues(seg){
      seg = seg.replace(/!important\b/g,'<span class="token css-important">!important</span>');
      seg = seg.replace(/#[0-9A-Fa-f]{3,8}\b/g, m => '<span class="token css-hashcolor">'+m+'</span>');
      seg = seg.replace(/\b(\d+(?:\.\d+)?)(px|rem|em|%|vh|vw|vmin|vmax|cm|mm|in|pt|pc|deg|rad|turn|s|ms)\b/g,
        (_m,num,unit)=>'<span class="token number">'+num+'</span><span class="token css-unit">'+unit+'</span>');
      seg = seg.replace(/\b(\d+(?:\.\d+)?)\b/g,'<span class="token number">$1</span>');
      seg = seg.replace(/\b([A-Za-z_][\w-]*)\s*(?=\()/g,'<span class="token css-value">$1</span>');
      return seg;
    }

    while(i<n){
      const c=src[i];
      if(c==="/"&&src[i+1]==="*"){ comment(); continue; }
      if(c==='"'||c==="'"){ str(c); continue; }
      if(c!=="{"){ selector(); continue; }

      out+='<span class="token brace">{</span>'; i++;
      while(i<n){
        if(src.startsWith("/*",i)){ comment(); continue; }
        if(src[i]==='"'||src[i]==="'"){ str(src[i]); continue; }
        if(src[i]==="}"){ out+='<span class="token brace">}</span>'; i++; break; }

        let p=i; while(i<n && src[i]!==":" && src[i]!=="}" && src[i]!==";") i++;
        const prop = src.slice(p,i);
        if(src[i]===":"){
          out+='<span class="token css-property">'+escapeHtml(prop.trim())+'</span><span class="token punct">:</span>'; i++;
          let v=i, depth=0;
          while(i<n){
            const ch=src[i];
            if(ch==="(") depth++; else if(ch===")") depth=Math.max(0,depth-1);
            if(depth===0 && (ch===";"||ch==="}")) break;
            if(ch==="/"&&src[i+1]==="*"){ comment(); continue; }
            if(ch==='"'||ch==="'"){ str(ch); continue; }
            i++;
          }
          let val = escapeHtml(src.slice(v,i));
          out += paintValues(val);
          if(src[i]===";"){ out+='<span class="token punct">;</span>'; i++; }
        }else{
          out += escapeHtml(prop);
          if(src[i]===";"){ out+='<span class="token punct">;</span>'; i++; }
        }
      }
    }
    return out;
  }

  /* ───────────── JS 하이라이터 ───────────── */
  function highlightJS(src){
    let i=0, out="", n=src.length, prev="";

    function lineC(){ let j=i+2; while(j<n && src[j] !== "\n") j++; out+='<span class="token comment">'+escapeHtml(src.slice(i,j))+'</span>'; i=j; }
    function blockC(){ const j=src.indexOf("*/", i+2); const e=j===-1? n : j+2; out+='<span class="token comment">'+escapeHtml(src.slice(i,e))+'</span>'; i=e; }
    function str(q){ let j=i+1, esc=false; for(; j<n; j++){ const c=src[j]; if(esc){esc=false;continue} if(c==="\\"){esc=true;continue} if(c===q){ j++; break; } } out+='<span class="token js-string">'+escapeHtml(src.slice(i,j))+'</span>'; i=j; }
    function tmpl(){
      let j=i+1, esc=false, acc="`";
      function innerS(q){ let k=j+1,e=false; for(;k<n;k++){ const c=src[k]; if(e){e=false;continue} if(c==="\\"){e=true;continue} if(c===q){k++;break} } j=k; }
      function innerLC(){ let k=j+2; while(k<n && src[k] !== "\n") k++; j=k; }
      function innerBC(){ const k=src.indexOf("*/", j+2); j = k===-1 ? n : k+2; }
      function expr(){
        acc+="${"; j+=2; let depth=1;
        while(j<n && depth>0){
          const c=src[j];
          if(c==="'"||c==='"'){ const s=j; innerS(c); acc+=escapeHtml(src.slice(s,j)); continue; }
          if(c==="`"){ acc+="`"; j++; continue; }
          if(c==="/"&&src[j+1]==="/"){ const s=j; innerLC(); acc+=escapeHtml(src.slice(s,j)); continue; }
          if(c==="/"&&src[j+1]==="*"){ const s=j; innerBC(); acc+=escapeHtml(src.slice(s,j)); continue; }
          if(c==="{") depth++; else if(c==="}") depth--;
          acc+=escapeHtml(c); j++;
        }
      }
      while(j<n){
        const c=src[j];
        if(esc){ esc=false; acc+=escapeHtml(c); j++; continue; }
        if(c==="\\"){ esc=true; acc+=escapeHtml(c); j++; continue; }
        if(c==="`"){ acc+="`"; j++; break; }
        if(c==="$" && src[j+1]==="{"){ expr(); continue; }
        acc+=escapeHtml(c); j++;
      }
      out+='<span class="token js-template">'+acc+'</span>'; i=j;
    }
    function number(){
      const m = src.slice(i).match(/^(?:0[xX][\da-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      if(m){ out+='<span class="token js-number">'+m[0]+'</span>'; i+=m[0].length; }
      else { out+=escapeHtml(src[i++]); }
    }
    function canRegex(prev){ return (!prev || /[({[=,:;!&|?+\-*%^~<>]$/.test(prev)); }
    function regex(){
      let j=i+1, esc=false, inClass=false;
      for(; j<n; j++){
        const c=src[j];
        if(esc){ esc=false; continue; }
        if(c==="\\"){ esc=true; continue; }
        if(c==="[" && !inClass){ inClass=true; continue; }
        if(c==="]" && inClass){ inClass=false; continue; }
        if(c==="/" && !inClass){ j++; break; }
      }
      while(j<n && /[a-z]/i.test(src[j])) j++;
      out+='<span class="token regex">'+escapeHtml(src.slice(i,j))+'</span>'; i=j;
    }

    function idStart(c){ return /[A-Za-z_$]/.test(c); }
    function idChar(c){ return /[\w$]/.test(c); }

    while(i<n){
      const c=src[i];

      if(c==="/"&&src[i+1]==="/"){ lineC(); prev=""; continue; }
      if(c==="/"&&src[i+1]==="*"){ blockC(); prev=""; continue; }
      if(c==="'"||c==='"'){ str(c); prev="str"; continue; }
      if(c==="`"){ tmpl(); prev="tpl"; continue; }
      if(c==="/"){ if(canRegex(prev)){ regex(); prev="re"; } else { out+='<span class="token operator">/</span>'; i++; prev="/"; } continue; }
      if(/\d/.test(c)){ number(); prev="num"; continue; }

      if(idStart(c)){
        let j=i+1; while(j<n && idChar(src[j])) j++;
        const name = src.slice(i,j); i=j;
        if(KEYWORDS_JS.has(name)){ out+='<span class="token js-keyword">'+name+'</span>'; prev=name; continue; }
        if(name==="null"){ out+='<span class="token js-null">null</span>'; prev=name; continue; }
        if(name==="true"||name==="false"){ out+='<span class="token js-boolean">'+name+'</span>'; prev=name; continue; }
        let k=i; while(k<n && WHITES.test(src[k])) k++;
        if(src[k]==="("){ out+='<span class="token js-function">'+escapeHtml(name)+'</span>'; prev="fn"; }
        else { out+='<span class="token js-identifier">'+escapeHtml(name)+'</span>'; prev="id"; }
        continue;
      }

      if("(){}[]".includes(c)){
        const cls=(c==="("||c===")")?"paren":(c==="{"||c==="}")?"brace":"bracket";
        out+='<span class="token '+cls+'">'+c+'</span>'; i++; prev=c; continue;
      }
      if(".,;:".includes(c)){
        out+='<span class="token punct">'+c+'</span>'; i++; prev=c; continue;
      }
      if("+-*%^~!&|?<>= ".includes(c)){
        out += (c===" ") ? " " : '<span class="token operator">'+escapeHtml(c)+'</span>';
        i++; prev=c; continue;
      }

      out += escapeHtml(c); i++; prev="";
    }
    return out;
  }

  /* ───────────── CPP 하이라이터 ───────────── */
  function highlightCPP(src) {
    // Use enhanced C++ highlighter based on code-cpp-highlight.js
    const raw = String(src ?? "");
    // 대용량 안전장치: escape만 수행
    if (raw.length > 400000) {
      return raw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }
    // 로컬 이스케이프: & < > 만 처리 (따옴표는 문자열에서 구분)
    function esc(s) {
      return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }
    // placeholder 테이블
    function createReplacer() {
      let idx = 0;
      const table = [];
      return {
        place(html) {
          // Use placeholders that avoid punctuation characters (no %), so later
          // punctuation highlighting doesn't split the marker. Prefix with __CPP
          // to make them distinctive and unlikely to collide.
          const ph = `__CPP${idx++}__`;
          table.push(html);
          return ph;
        },
        restore(html) {
          for (let k = 0; k < table.length; k++) {
            html = html.replace(`__CPP${k}__`, table[k]);
          }
          return html;
        }
      };
    }
    // 키워드 세트
    const CPP_CONTROL_FLOW = ["if","else","switch","case","default","for","while","do","break","continue","return","goto","try","catch","throw"];
    const CPP_KEYWORDS = ["alignas","alignof","and","and_eq","asm","atomic_cancel","atomic_commit","atomic_noexcept","auto","bitand","bitor","bool","char","char8_t","char16_t","char32_t","wchar_t","class","const","consteval","constexpr","constinit","const_cast","continue","decltype","delete","double","dynamic_cast","enum","explicit","export","extern","false","float","friend","inline","int","long","mutable","namespace","new","noexcept","not","not_eq","nullptr","operator","or","or_eq","private","protected","public","register","reinterpret_cast","requires","short","signed","sizeof","static","static_assert","static_cast","struct","template","this","thread_local","true","typedef","typeid","typename","union","unsigned","using","virtual","void","volatile","xor","xor_eq"];
    const CPP_MSVC_KEYWORDS = ["__cdecl","__stdcall","__fastcall","__vectorcall","__thiscall","__unaligned","__w64","__forceinline","__restrict","__declspec"];
    const CPP_WIN_TYPES = ["BOOL","BYTE","CHAR","DWORD","DWORD64","FLOAT","HANDLE","HINSTANCE","HMODULE","HWND","LONG","LPARAM","LPVOID","LRESULT","PVOID","SIZE_T","TCHAR","UINT","ULONG","WPARAM","WCHAR","WORD"];
    // 정규식 도우미
    function setToRegexWordBoundary(list) {
      return new RegExp("\\b(" + list.join("|") + ")\\b", "g");
    }
    const RE_CF   = setToRegexWordBoundary(CPP_CONTROL_FLOW);
    const RE_KW   = setToRegexWordBoundary(CPP_KEYWORDS);
    const RE_MSVC = setToRegexWordBoundary(CPP_MSVC_KEYWORDS);
    const RE_WIN  = setToRegexWordBoundary(CPP_WIN_TYPES);
    // 숫자/전처리기/주석/문자열
    const RE_NUMBER = /\b(?:0[xX][0-9A-Fa-f]+|0[bB][01]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[uUlLfF]*)\b/g;
    const RE_PREP_LINE = /^[ \t]*#[^\n]*/gm;
    const RE_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
    const RE_LINE_COMMENT  = /\/\/[^\n]*/g;
    const RE_RAW_STRING = /R\"([^\s()\\]{0,16})\(([\s\S]*?)\)\1\"/g;
    const RE_STRING     = /(?:u8|u|U|L)?\"(?:[^\"\\]|\\[\s\S])*\"/g;
    const RE_CHAR       = /(?:u8|u|U|L)?\'(?:[^'\\]|\\[\s\S])*\'/g;
    const R = createReplacer();
    let temp = raw;
    // 1) 원시 문자열
    temp = temp.replace(RE_RAW_STRING, (m, delim, body) => {
      const inner = esc(body).replace(/\\[abfnrtv\\'\"?]/g, (x) => `<span class="token cpp-escape">${esc(x)}</span>`);
      const html = `<span class="token cpp-string"><span class="token cpp-string-quotes">R\"${esc(delim)}(</span>${inner}<span class="token cpp-string-quotes">)${esc(delim)}\"</span></span>`;
      return R.place(html);
    });
    // 2) 일반 문자열
    temp = temp.replace(RE_STRING, (m) => {
      const firstQuote = m.indexOf('"');
      const prefix = m.slice(0, firstQuote);
      const inner = m.slice(firstQuote + 1, m.lastIndexOf('"'));
      const rendered = esc(inner).replace(/\\[abfnrtv\\'\"?]/g, (x) => `<span class="token cpp-escape">${esc(x)}</span>`);
      return R.place(`<span class="token cpp-string">${prefix ? esc(prefix) : ""}<span class="token cpp-string-quotes">\"</span>${rendered}<span class="token cpp-string-quotes">\"</span></span>`);
    });
    // 3) 문자 리터럴
    temp = temp.replace(RE_CHAR, (m) => {
      const firstQuote = m.indexOf("'");
      const prefix = m.slice(0, firstQuote);
      const inner = m.slice(firstQuote + 1, m.lastIndexOf("'"));
      const rendered = esc(inner).replace(/\\[abfnrtv\\'\"?]/g, (x) => `<span class="token cpp-escape">${esc(x)}</span>`);
      return R.place(`<span class="token cpp-string">${prefix ? esc(prefix) : ""}<span class="token cpp-string-quotes">'</span>${rendered}<span class="token cpp-string-quotes">'</span></span>`);
    });
    // 4) 주석 (블록/라인)
    temp = temp
      .replace(RE_BLOCK_COMMENT, (m) => R.place(`<span class="token cpp-comment">${esc(m)}</span>`))
      .replace(RE_LINE_COMMENT,  (m) => R.place(`<span class="token cpp-comment">${esc(m)}</span>`));
    // 5) 전처리기 라인
    temp = temp.replace(RE_PREP_LINE, (m) => R.place(`<span class="token cpp-preprocessor">${esc(m)}</span>`));
    // 6) 숫자
    temp = temp.replace(RE_NUMBER, (m) => R.place(`<span class="token cpp-number">${esc(m)}</span>`));
    // 7) 키워드 (제어흐름 → 일반 → MSVC → Windows)
    temp = temp.replace(RE_CF,   (m) => R.place(`<span class="token cpp-keyword-control-flow">${esc(m)}</span>`));
    temp = temp.replace(RE_KW,   (m) => R.place(`<span class="token cpp-keyword">${esc(m)}</span>`));
    temp = temp.replace(RE_MSVC, (m) => R.place(`<span class="token cpp-keyword-msvc">${esc(m)}</span>`));
    temp = temp.replace(RE_WIN,  (m) => R.place(`<span class="token cpp-system-type">${esc(m)}</span>`));
    // 8) 함수 이름 (키워드/윈도우 타입/숫자/전처리기 등 제외)
    temp = temp.replace(/\b([A-Za-z_]\w*)\s*(?=\()/g, (m, name) => {
      if (
        CPP_CONTROL_FLOW.includes(name) ||
        CPP_KEYWORDS.includes(name) ||
        CPP_MSVC_KEYWORDS.includes(name) ||
        CPP_WIN_TYPES.includes(name)
      ) return m;
      return R.place(`<span class="token cpp-function">${esc(name)}</span>`);
    });
    // 9) 구두점/연산자
    temp = temp.replace(/[\[\]\{\}\(\)\.,;:\?\+\-\*\/\%!\=<>|&\^~]/g, (m) =>
      R.place(`<span class="token cpp-punct">${esc(m)}</span>`)
    );
    // 10) placeholder 복원
    const out = R.restore(temp);
    return out;
  }

  /* ───────────── 퍼사드 ───────────── */
  function highlightBlock(pre, code, lang){
    const SUPPORTED = new Set(["html","css","js","cpp"]);
    if(!SUPPORTED.has(lang)) return;

    if(code.hasAttribute("data-highlighted")) return;
    const raw = code.textContent || "";
    if(raw.length > 400000) return; // 안전장치

    let html;
    if(lang === "html") html = highlightHTML(raw);
    else if(lang === "css") html = highlightCSS(raw);
    else if(lang === "js") html = highlightJS(raw);
    else if(lang === "cpp") html = highlightCPP(raw);
    else html = highlightHTML(raw);

    code.innerHTML = html;
    pre.setAttribute("data-highlighted","1");
    code.setAttribute("data-highlighted","1");
  }

  function findTargets(){
    const pairs = [];
    const pres = Array.from(document.querySelectorAll("pre"));
    for(const pre of pres){
      const code = pre.querySelector("code") || pre;
      if(code.hasAttribute("data-highlighted")) continue;
      if((code.textContent||"").trim().length < 2) continue;
      pairs.push([pre, code]);
    }
    return pairs;
  }

  function highlightAll(){
    const t = findTargets();
    batched(t, ([pre, code]) => {
      const lang = detectLang(pre, code);
      highlightBlock(pre, code, lang);
    }, 8);
  }

window.codebox81 = { highlightAll, highlightHTML, highlightCSS, highlightJS, highlightCPP };
})();

document.addEventListener('DOMContentLoaded', () => {
  codebox81.highlightAll();
}, { once: true });