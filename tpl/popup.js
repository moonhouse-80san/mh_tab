/**
 * mh_tab 에디터 컴포넌트 팝업 스크립트
 **/

var selected_node = null;
var item_seq = 0;
var drag_src = null;
var MAX_TABS = 20;

/* ── 에디터 작성 화면에서 직접 수정한 내용을 mh_tabs 속성에 실시간으로 반영 ──
 * class 속성이나 <style> 태그는 저장(HTML 정화) 과정에서 사라질 수 있지만,
 * 마커 div 자신의 속성(mh_tabs)은 에디터 컴포넌트로 인식되어 그대로 보존된다.
 * 그래서 사용자가 탭 제목/내용을 에디터에서 직접 타이핑할 때마다 그 값을
 * 이 속성에 계속 반영해 두면, 등록(저장) 시에도 최신 내용이 정확히 남는다. */
function readTabsFromNode(wrapNode) {
	var labels = wrapNode.querySelectorAll('.mh_tab_btn');
	var panels = wrapNode.querySelectorAll('.mh_tab_panel');
	var count  = Math.max(labels.length, panels.length);
	var tabsArr = [];
	for (var i = 0; i < count; i++) {
		tabsArr.push({
			title:   labels[i] ? labels[i].textContent.trim() : '',
			content: panels[i] ? panels[i].innerHTML : ''
		});
	}
	return tabsArr;
}

function attachLiveSync(wrapNode) {
	if (!wrapNode || wrapNode.getAttribute('data-mh-tab-sync-bound') === '1') return;
	wrapNode.setAttribute('data-mh-tab-sync-bound', '1');

	var doc = wrapNode.ownerDocument;

	function syncNow() {
		wrapNode.setAttribute('mh_tabs', JSON.stringify(readTabsFromNode(wrapNode)));
	}

	doc.addEventListener('input', function(e) {
		if (wrapNode.contains(e.target)) syncNow();
	}, true);

	syncNow();
}

/* ── 유틸 ── */
function escText(str) {
	return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
	return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
}
function isValidHex(val) {
	return /^#[0-9a-fA-F]{3}$/.test(val) || /^#[0-9a-fA-F]{6}$/.test(val);
}
function bindColorPair(pickerId, hexId) {
	var picker = xGetElementById(pickerId);
	var hex    = xGetElementById(hexId);
	picker.addEventListener('input',  function() { hex.value = picker.value; updatePreview(); });
	picker.addEventListener('change', function() { hex.value = picker.value; updatePreview(); });
	hex.addEventListener('input', function() {
		var v = hex.value.trim();
		if (v && v.charAt(0) !== '#') v = '#' + v;
		hex.value = v;
		if (isValidHex(v)) { picker.value = v; updatePreview(); }
	});
	hex.addEventListener('blur', function() {
		if (!isValidHex(hex.value)) hex.value = picker.value;
		updatePreview();
	});
}

/* 폰트 크기 정규식: 14px, 1.2em, .85em, 100%, 12pt 형식만 허용 */
var FONT_SIZE_RE = /^\d+(\.\d+)?(px|em|rem|%|pt)$/;
function isValidFontSize(val) {
	return FONT_SIZE_RE.test(String(val || '').trim());
}
function getSizeValue(id) {
	var el = xGetElementById(id);
	if (!el) return '';
	var v = el.value.trim();
	return isValidFontSize(v) ? v : '';
}
function bindSizeInput(id) {
	var el = xGetElementById(id);
	if (!el) return;
	el.addEventListener('input', function() {
		el.style.borderColor = '';
		updatePreview();
	});
	el.addEventListener('blur', function() {
		var v = el.value.trim();
		el.style.borderColor = (v && !isValidFontSize(v)) ? '#c00' : '';
	});
}
function getColorValue(id, def) {
	var el = xGetElementById(id);
	var v = el ? el.value.trim() : '';
	return isValidHex(v) ? v : def;
}

/* ── 탭 항목 Drag & Drop ── */
function onDragStart(e) {
	drag_src = this.closest('.tab-item');
	drag_src.classList.add('dragging');
	e.dataTransfer.effectAllowed = 'move';
	e.dataTransfer.setData('text/plain', drag_src.id);
}
function onDragOver(e) {
	e.preventDefault();
	e.dataTransfer.dropEffect = 'move';
	var target = e.target.closest('.tab-item');
	if (!target || target === drag_src) return;
	var list = xGetElementById('tab-list');
	var rect = target.getBoundingClientRect();
	if (e.clientY < rect.top + rect.height / 2) {
		list.insertBefore(drag_src, target);
	} else {
		list.insertBefore(drag_src, target.nextSibling);
	}
}
function onDragEnd() {
	if (drag_src) drag_src.classList.remove('dragging');
	drag_src = null;
	renumberTabItems();
	updatePreview();
}
function bindDragEvents(wrap, handle) {
	wrap.setAttribute('draggable', 'true');
	handle.addEventListener('mousedown', function() { wrap.setAttribute('draggable', 'true'); });
	wrap.addEventListener('dragstart', onDragStart);
	wrap.addEventListener('dragover',  onDragOver);
	wrap.addEventListener('dragend',   onDragEnd);
}

/* 순서 번호(화면 표시용) 갱신 */
function renumberTabItems() {
	var items = document.querySelectorAll('#tab-list > .tab-item');
	items.forEach(function(el, i) {
		var idxEl = el.querySelector('.tab-idx');
		if (idxEl) idxEl.textContent = (i + 1) + '.';
	});
}

/* ── 탭 항목 추가 ── */
function addTabItem(title, content) {
	var current = document.querySelectorAll('#tab-list > .tab-item').length;
	if (current >= MAX_TABS) {
		alert('탭은 최대 ' + MAX_TABS + '개까지만 추가할 수 있습니다.');
		return;
	}

	item_seq++;
	var seq = item_seq;

	var wrap = document.createElement('div');
	wrap.className = 'tab-item';
	wrap.id = 'tabitem_' + seq;

	/* 1행: 핸들 + 순번 + 제목 입력 + 삭제 */
	var row1 = document.createElement('div');
	row1.className = 'item-row1';

	var handle = document.createElement('span');
	handle.className = 'drag-handle';
	handle.title = '드래그하여 순서 변경';
	handle.textContent = '⠿';

	var idx = document.createElement('span');
	idx.className = 'tab-idx';

	var inTitle = document.createElement('input');
	inTitle.type = 'text';
	inTitle.id = 'tab_title_' + seq;
	inTitle.className = 'inputTypeText f-title';
	inTitle.placeholder = '탭 제목';
	inTitle.value = title || '';
	inTitle.addEventListener('input', updatePreview);

	var btnDel = document.createElement('button');
	btnDel.type = 'button';
	btnDel.className = 'btn-del';
	btnDel.textContent = '×';
	btnDel.addEventListener('click', (function(s) { return function() { removeTabItem(s); }; })(seq));

	row1.appendChild(handle);
	row1.appendChild(idx);
	row1.appendChild(inTitle);
	row1.appendChild(btnDel);

	/* 2행: 내용(HTML 가능) textarea */
	var row2 = document.createElement('div');
	row2.className = 'item-row2';

	var lbl = document.createElement('span');
	lbl.className = 'content-label';
	lbl.textContent = '내용 (HTML 태그 사용 가능)';

	var inContent = document.createElement('textarea');
	inContent.id = 'tab_content_' + seq;
	inContent.className = 'tab-content-area';
	inContent.placeholder = '<p>탭에 표시할 내용을 입력하세요. HTML 태그를 사용할 수 있습니다.</p>';
	inContent.value = content || '';
	inContent.addEventListener('input', updatePreview);

	row2.appendChild(lbl);
	row2.appendChild(inContent);

	wrap.appendChild(row1);
	wrap.appendChild(row2);

	xGetElementById('tab-list').appendChild(wrap);
	bindDragEvents(wrap, handle);
	renumberTabItems();
	updatePreview();
}

/* ── 탭 항목 삭제 ── */
function removeTabItem(seq) {
	var el = xGetElementById('tabitem_' + seq);
	if (el) el.parentNode.removeChild(el);
	renumberTabItems();
	updatePreview();
}

/* ── 현재 탭 목록을 배열로 수집 (DOM 순서 = 화면상 순서) ── */
function collectTabsArray() {
	var arr = [];
	document.querySelectorAll('#tab-list > .tab-item').forEach(function(wrap) {
		var id = wrap.id.replace('tabitem_', '');
		var titleEl = xGetElementById('tab_title_' + id);
		var contentEl = xGetElementById('tab_content_' + id);
		arr.push({
			title: titleEl ? titleEl.value : '',
			content: contentEl ? contentEl.value : ''
		});
	});
	return arr;
}

/* ── 라디오+레이블+패널 HTML 생성 (groupName만 다르면 실제 출력물과 100% 동일한 구조) ── */
function buildTabsMarkup(groupName, tabsArr) {
	var radioHtml = '', navHtml = '', panelHtml = '';
	tabsArr.forEach(function(tab, i) {
		var radioId = groupName + '_' + i;
		var checked = (i === 0) ? ' checked' : '';
		var title = escText(tab.title || ('탭' + (i + 1)));
		radioHtml += '<input type="radio" class="mh_tab_radio" name="' + groupName + '" id="' + radioId + '"' + checked + ' />';
		navHtml   += '<label class="mh_tab_btn" for="' + radioId + '">' + title + '</label>';
		panelHtml += '<div class="mh_tab_panel" data-tab-title="' + escAttr(tab.title || ('탭' + (i + 1))) + '">' + (tab.content || '') + '</div>';
	});
	return { radioHtml: radioHtml, navHtml: navHtml, panelHtml: panelHtml };
}

function currentStyleOptions() {
	return {
		active_bg:      getColorValue('tab_active_bg',      '#3a7abf'),
		active_color:   getColorValue('tab_active_color',   '#ffffff'),
		inactive_bg:    getColorValue('tab_inactive_bg',    '#f5f5f5'),
		inactive_color: getColorValue('tab_inactive_color', '#555555'),
		content_color:  getColorValue('tab_content_color',  '#333333'),
		content_bg:     getColorValue('tab_content_bg',     '#ffffff'),
		title_size:     getSizeValue('tab_title_size')   || '15px',
		content_size:   getSizeValue('tab_content_size') || '14px'
	};
}

function styleVarString(opt) {
	return '--mh_tab_active_bg:' + opt.active_bg + ';'
		+ '--mh_tab_active_color:' + opt.active_color + ';'
		+ '--mh_tab_inactive_bg:' + opt.inactive_bg + ';'
		+ '--mh_tab_inactive_color:' + opt.inactive_color + ';'
		+ '--mh_tab_content_color:' + opt.content_color + ';'
		+ '--mh_tab_content_bg:' + opt.content_bg + ';'
		+ '--mh_tab_title_size:' + opt.title_size + ';'
		+ '--mh_tab_content_size:' + opt.content_size + ';';
}

/* ── 미리보기 갱신 ── */
function updatePreview() {
	var tabsArr = collectTabsArray();
	var opt = currentStyleOptions();
	var preview = xGetElementById('preview-area');

	if (!tabsArr.length) {
		preview.innerHTML = '<div class="mh_tab_empty">탭을 추가하면 미리보기가 표시됩니다.</div>';
		return;
	}

	var markup = buildTabsMarkup('mh_tab_group_preview', tabsArr);
	var html = '<div class="mh_tab_wrap" style="' + styleVarString(opt) + '">'
		+ markup.radioHtml
		+ '<div class="mh_tab_nav">' + markup.navHtml + '</div>'
		+ '<div class="mh_tab_panels">' + markup.panelHtml + '</div>'
		+ '</div>';

	preview.innerHTML = html;
}

/* 에디터 작성 영역(CKEditor iframe)은 front-end처럼 mh_tab.css를 별도로 불러오지
 * 않으므로, 삽입되는 마크업 안에 구조/색상 CSS를 <style>로 함께 넣어서 에디터
 * 작성 화면에서도 실제 출력물과 동일하게(팝업 미리보기처럼) 보이도록 한다.
 * front-end 표시 시에는 transHTML()이 display.html 기준으로 전체를 다시 만들어
 * 내보내므로(이때는 mh_tab.css를 정식으로 불러온다) 이 <style> 태그는 자연히
 * 대체되어 중복 문제가 없다. */
function buildInlineTabCSS() {
	return '<style>'
		+ '.mh_tab_wrap{position:relative}'
		+ '.mh_tab_radio{position:absolute;width:0;height:0;opacity:0;pointer-events:none}'
		+ '.mh_tab_nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:0px;background:transparent}'
		+ '.mh_tab_btn{flex:1 1 auto;text-align:center;padding:10px 14px;background: var(--mh_tab_inactive_bg, #f5f5f5);color:var(--mh_tab_inactive_color,#555555);font-size:var(--mh_tab_title_size,15px);user-select:none;border-radius: 14px 14px 0 0}'
		+ buildNthOfTypeRules('.mh_tab_nav .mh_tab_btn', 'background:var(--mh_tab_active_bg,#3a7abf);color:var(--mh_tab_active_color,#ffffff);font-weight:600;')
		+ '.mh_tab_panels{border: 1px solid var(--mh_tab_inactive_bg, #f5f5f5);border-top:0px;border-radius: 0 0 10px 10px;overflow:hidden;background:var(--mh_tab_content_bg,#fff)}'
		/* 에디터 작성 화면에서는 실제 사이트와 달리 선택되지 않은 탭도 숨기지 않고
		 * 전부 순서대로 펼쳐서 보여준다 — 그래야 각 탭 내용을 눈으로 보면서
		 * 바로 수정/추가할 수 있기 때문이다(실제 사이트 노출 방식은 front-end에서
		 * mh_tab.css가 따로 적용되어 기존처럼 선택된 탭만 보인다). */
		+ '.mh_tab_panel{display:block !important;padding:16px 14px 14px;font-size:var(--mh_tab_content_size,14px);color:var(--mh_tab_content_color,#333333);border-top:1px dashed #ddd;position:relative}'
		+ '.mh_tab_panel:first-of-type{border-top:none}'
		+ '.mh_tab_panel::before{content:"▸ " attr(data-tab-title) " 내용";display:block;font-size:12px;font-weight:600;color:#888;margin-bottom:8px}'
		+ '</style>';
}

/* .mh_tab_radio:nth-of-type(N):checked ~ .mh_tab_nav .mh_tab_btn:nth-of-type(N) { ... }
 * 형태의 규칙을 MAX_TABS 개수만큼 생성 (mh_tab.css의 규칙과 동일) */
function buildNthOfTypeRules(targetSelector, decl) {
	var selectors = [];
	for (var i = 1; i <= MAX_TABS; i++) {
		selectors.push('.mh_tab_radio:nth-of-type(' + i + '):checked ~ ' + targetSelector + ':nth-of-type(' + i + ')');
	}
	return selectors.join(',') + '{' + decl + '}';
}

/* ── 최종 삽입용 HTML 생성 ── */
function buildTabWrapperHTML() {
	var tabsArr = collectTabsArray();
	var opt = currentStyleOptions();
	var groupName = 'mh_tab_group_' + Math.random().toString(36).slice(2, 10);
	var markup = buildTabsMarkup(groupName, tabsArr);
	var tabsJson = JSON.stringify(tabsArr);

	return '<div class="mh_tab_wrap"'
		+ ' editor_component="mh_tab"'
		+ ' mh_instance="' + groupName + '"'
		+ ' mh_tabs="' + escAttr(tabsJson) + '"'
		+ ' active_bg="' + opt.active_bg + '"'
		+ ' active_color="' + opt.active_color + '"'
		+ ' inactive_bg="' + opt.inactive_bg + '"'
		+ ' inactive_color="' + opt.inactive_color + '"'
		+ ' content_color="' + opt.content_color + '"'
		+ ' content_bg="' + opt.content_bg + '"'
		+ ' title_size="' + opt.title_size + '"'
		+ ' content_size="' + opt.content_size + '"'
		+ ' style="' + styleVarString(opt) + '">'
		+ buildInlineTabCSS()
		+ markup.radioHtml
		+ '<div class="mh_tab_nav">' + markup.navHtml + '</div>'
		+ '<div class="mh_tab_panels">' + markup.panelHtml + '</div>'
		+ '</div>';
}

function insertTab() {
	var tabsArr = collectTabsArray();
	if (!tabsArr.length) {
		alert('최소 1개 이상의 탭을 추가해주세요.');
		return;
	}
	if (typeof opener === 'undefined' || !opener) { window.close(); return; }

	var html = buildTabWrapperHTML();
	var instanceMatch = html.match(/mh_instance="([^"]+)"/);
	var instanceId = instanceMatch ? instanceMatch[1] : null;

	if (selected_node && selected_node.parentNode) {
		try {
			selected_node.outerHTML = html;
		} catch(e) {
			try {
				var ownerDoc = selected_node.ownerDocument;
				var tmp = ownerDoc.createElement('div');
				tmp.innerHTML = html;
				selected_node.parentNode.replaceChild(tmp.firstChild, selected_node);
			} catch(e2) {
				opener.editorFocus(opener.editorPrevSrl);
				opener.editorReplaceHTML(opener.editorGetIFrame(opener.editorPrevSrl), html + '<br />');
			}
		}
	} else {
		opener.editorFocus(opener.editorPrevSrl);
		opener.editorReplaceHTML(opener.editorGetIFrame(opener.editorPrevSrl), html + '<br />');
	}

	/* 방금 삽입/교체된 마커를 실제 에디터 DOM에서 다시 찾아 실시간 동기화를 건다.
	 * (outerHTML 교체 시 기존 selected_node 참조는 더 이상 문서에 붙어있지 않으므로
	 * mh_instance 속성으로 새로 만들어진 노드를 찾아야 한다.) */
	try {
		var iframeDoc = opener.editorGetIFrame(opener.editorPrevSrl).contentDocument
			|| opener.editorGetIFrame(opener.editorPrevSrl).contentWindow.document;
		var newNode = instanceId ? iframeDoc.querySelector('[mh_instance="' + instanceId + '"]') : null;
		if (newNode) attachLiveSync(newNode);
	} catch (e3) { /* 동기화 연결 실패해도 삽입 자체는 이미 끝났으므로 무시 */ }

	opener.editorFocus(opener.editorPrevSrl);
	window.close();
}

/* ── 기존 노드 복원 (편집 시) ── */
function getTab() {
	if (typeof opener === 'undefined' || !opener) return;
	var node = opener.editorPrevNode;
	if (!node || !node.classList || !node.classList.contains('mh_tab_wrap')) return;
	selected_node = node;

	var ab = node.getAttribute('active_bg')      || '#3a7abf';
	var ac = node.getAttribute('active_color')   || '#ffffff';
	var ib = node.getAttribute('inactive_bg')    || '#f5f5f5';
	var ic = node.getAttribute('inactive_color') || '#555555';
	var cc = node.getAttribute('content_color')  || '#333333';
	var cbg = node.getAttribute('content_bg')    || '#ffffff';

	xGetElementById('tab_active_bg').value        = ab;
	xGetElementById('tab_active_bg_hex').value    = ab;
	xGetElementById('tab_active_color').value     = ac;
	xGetElementById('tab_active_color_hex').value = ac;
	xGetElementById('tab_inactive_bg').value        = ib;
	xGetElementById('tab_inactive_bg_hex').value    = ib;
	xGetElementById('tab_inactive_color').value     = ic;
	xGetElementById('tab_inactive_color_hex').value = ic;
	xGetElementById('tab_content_color').value      = cc;
	xGetElementById('tab_content_color_hex').value  = cc;
	xGetElementById('tab_content_bg').value         = cbg;
	xGetElementById('tab_content_bg_hex').value     = cbg;

	xGetElementById('tab_title_size').value   = node.getAttribute('title_size')   || '';
	xGetElementById('tab_content_size').value = node.getAttribute('content_size') || '';

	/* 제목/내용은 mh_tabs 속성(팝업에서 처음 삽입했을 때의 JSON 스냅샷)이 아니라
	 * 실제 편집 화면(DOM)에 남아있는 값을 최우선으로 읽는다. 에디터 작성 화면에서
	 * 직접 수정한 제목/내용이 있다면 그 값을 반영하기 위함이다. */
	var labels = node.querySelectorAll('.mh_tab_btn');
	var panels = node.querySelectorAll('.mh_tab_panel');
	var count = Math.max(labels.length, panels.length);
	var tabsArr = [];

	if (count > 0) {
		for (var i = 0; i < count; i++) {
			tabsArr.push({
				title:   labels[i] ? labels[i].textContent.trim() : '',
				content: panels[i] ? panels[i].innerHTML : ''
			});
		}
	} else {
		/* 안전장치: 본문에서 탭 구조를 찾지 못했을 때만 mh_tabs 속성(JSON) 사용.
		 * DOM getAttribute()는 이미 HTML 엔티티를 디코딩한 상태로 반환하므로 그대로 JSON.parse 가능 */
		var tabsRaw = node.getAttribute('mh_tabs') || '[]';
		try { tabsArr = JSON.parse(tabsRaw); } catch (e) { tabsArr = []; }
		if (!Array.isArray(tabsArr)) tabsArr = [];
	}

	tabsArr.forEach(function(tab) {
		addTabItem(tab.title || '', tab.content || '');
	});

	attachLiveSync(node);
	updatePreview();
}

/* ── 초기화 ── */
(function() {
	function onLoad() {
		bindColorPair('tab_active_bg',      'tab_active_bg_hex');
		bindColorPair('tab_active_color',   'tab_active_color_hex');
		bindColorPair('tab_inactive_bg',    'tab_inactive_bg_hex');
		bindColorPair('tab_inactive_color', 'tab_inactive_color_hex');
		bindColorPair('tab_content_color',  'tab_content_color_hex');
		bindColorPair('tab_content_bg',     'tab_content_bg_hex');

		['tab_title_size', 'tab_content_size'].forEach(bindSizeInput);

		xGetElementById('tab-list').addEventListener('dragover', function(e) { e.preventDefault(); });

		var node = (typeof opener !== 'undefined' && opener) ? opener.editorPrevNode : null;
		var isEditing = node && node.classList && node.classList.contains('mh_tab_wrap');

		if (isEditing) {
			getTab();
		} else {
			addTabItem('', '');
			addTabItem('', '');
		}
	}

	if (typeof xAddEventListener !== 'undefined') xAddEventListener(window, 'load', onLoad);
	else window.addEventListener('load', onLoad);
})();
