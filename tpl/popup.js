/**
 * mh_tab 에디터 컴포넌트 팝업 스크립트
 **/

var selected_node = null;
var item_seq = 0;
var drag_src = null;
var MAX_TABS = 20;

/* 탭별 기본 색상 팔레트 (0-based 인덱스, mh_tab.class.php의 DEFAULT_TAB_PALETTE와 동일하게 맞춘다).
 * 1~3번 탭은 고정 파스텔톤 기본색, 4번째 탭부터는 비선택 탭 색상을 그대로 사용(강조 없음).
 * 내용 배경색은 탭 색상과 같은 색조를 유지하면서 가능한 한 가장 연하게(흰색에 90% 가깝게)
 * 만들어, 검정 글자가 뚜렷하게 잘 보이도록 한다. 탭 색상은 선택 여부와 무관하게 항상 유지된다. */
var DEFAULT_TAB_PALETTE = [
	{ tab_bg: '#bfe4f5', tab_color: '#155a7a', content_bg: '#f9fcfe', content_color: '#000000' }, // 1번: 파스텔 하늘색
	{ tab_bg: '#fcefa9', tab_color: '#7a6600', content_bg: '#fffdf6', content_color: '#000000' }, // 2번: 파스텔 노란색
	{ tab_bg: '#dcefa8', tab_color: '#5c7a1e', content_bg: '#fcfdf6', content_color: '#000000' }  // 3번: 파스텔 연두
];
function defaultTabColorsFor(idx) {
	if (DEFAULT_TAB_PALETTE[idx]) return DEFAULT_TAB_PALETTE[idx];
	var ib = getColorValue('tab_inactive_bg', '#f5f5f5');
	var ic = getColorValue('tab_inactive_color', '#555555');
	return { tab_bg: ib, tab_color: ic, content_bg: '#ffffff', content_color: '#000000' };
}

/* 현재 선택된 책갈피 모양('round' 또는 'slant')을 읽어온다 */
function getShapeValue() {
	var slant = xGetElementById('tab_shape_slant');
	return (slant && slant.checked) ? 'slant' : 'round';
}

/* wrapNode 안의 라벨에 이미 적용된 모양(class)을 읽어, 실시간 동기화 시 mh_tabs JSON에 그대로 보존한다 */
function currentShapeFromNode(wrapNode) {
	var label = wrapNode.querySelector('.mh_tab_btn');
	return (label && label.classList.contains('mh_tab_shape_slant')) ? 'slant' : 'round';
}

/* label/panel 요소에 인라인으로 지정된 CSS 커스텀 변수 값을 읽어온다 */
function getCssVar(el, name) {
	return (el && el.style) ? el.style.getPropertyValue(name).trim() : '';
}

/* ── 에디터 작성 화면에서 직접 수정한 내용을 mh_tabs 속성에 실시간으로 반영 ──
 * class 속성이나 <style> 태그는 저장(HTML 정화) 과정에서 사라질 수 있지만,
 * 마커 div 자신의 속성(mh_tabs)은 에디터 컴포넌트로 인식되어 그대로 보존된다.
 * 그래서 사용자가 탭 제목/내용을 에디터에서 직접 타이핑할 때마다 그 값을
 * 이 속성에 계속 반영해 두면, 등록(저장) 시에도 최신 내용이 정확히 남는다.
 * 탭별 색상(인라인 CSS 변수)도 함께 읽어 같이 보존해야, 실시간 동기화 과정에서
 * mh_tabs 속성이 덮어써지면서 색상 정보가 사라지는 것을 막을 수 있다. */
function readTabsFromNode(wrapNode) {
	var labels = wrapNode.querySelectorAll('.mh_tab_btn');
	var panels = wrapNode.querySelectorAll('.mh_tab_panel');
	var count  = Math.max(labels.length, panels.length);
	var tabsArr = [];
	for (var i = 0; i < count; i++) {
		var label = labels[i], panel = panels[i];
		tabsArr.push({
			title:         label ? label.textContent.trim() : '',
			content:       panel ? panel.innerHTML : '',
			tab_bg:        getCssVar(label, '--mh_tab_inactive_bg'),
			tab_color:     getCssVar(label, '--mh_tab_inactive_color'),
			content_bg:    getCssVar(panel, '--mh_tab_content_bg'),
			content_color: getCssVar(panel, '--mh_tab_content_color')
		});
	}
	return tabsArr;
}

function attachLiveSync(wrapNode) {
	if (!wrapNode || wrapNode.getAttribute('data-mh-tab-sync-bound') === '1') return;
	wrapNode.setAttribute('data-mh-tab-sync-bound', '1');

	var doc = wrapNode.ownerDocument;

	function syncNow() {
		wrapNode.setAttribute('mh_tabs', JSON.stringify({
			shape: currentShapeFromNode(wrapNode),
			tabs: readTabsFromNode(wrapNode)
		}));
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
/* 완전히 빈 <div>는 브라우저가 그 안에 캐럿을 정상적으로 두지 못해,
 * 편집 화면에서 Enter를 누르면 캐럿이 상위 탭 구조 전체(.mh_tab_wrap)로
 * 튀어 탭 전체가 통째로 복제되는 문제가 생긴다. 빈 문단(<p><br></p>) 하나를
 * 넣어 두면 캐럿이 그 문단 안에 자리를 잡아 Enter가 문단 안에서만 정상 동작한다. */
function normalizeTabContent(content) {
	content = (content || '').trim();
	return content ? content : '<p><br></p>';
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
/* 색상 picker + hex 입력 한 쌍을 만들어 반환 (탭별 색상 필드에서 4번 재사용) */
function createColorField(pickerId, hexId, labelText, value) {
	var field = document.createElement('div');
	field.className = 'color-wrap';

	var lbl = document.createElement('label');
	lbl.className = 'opt-label';
	lbl.textContent = labelText;

	var picker = document.createElement('input');
	picker.type = 'color';
	picker.id = pickerId;
	picker.className = 'color-picker';
	picker.value = value;

	var hex = document.createElement('input');
	hex.type = 'text';
	hex.id = hexId;
	hex.className = 'inputTypeText hex-input';
	hex.value = value;
	hex.maxLength = 7;

	field.appendChild(lbl);
	field.appendChild(picker);
	field.appendChild(hex);
	return field;
}

function addTabItem(title, content, tabBg, tabColor, contentBg, contentColor) {
	var current = document.querySelectorAll('#tab-list > .tab-item').length;
	if (current >= MAX_TABS) {
		alert('탭은 최대 ' + MAX_TABS + '개까지만 추가할 수 있습니다.');
		return;
	}

	item_seq++;
	var seq = item_seq;
	/* 인덱스 기준 기본 팔레트(1~3번 파스텔, 이후 비선택 색과 동일)를 색상 값이 주어지지 않았을 때 사용 */
	var paletteIdx = current;
	var palette = defaultTabColorsFor(paletteIdx);
	tabBg        = tabBg        || palette.tab_bg;
	tabColor     = tabColor     || palette.tab_color;
	contentBg    = contentBg    || palette.content_bg;
	contentColor = contentColor || palette.content_color;

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

	/* 3행: 탭 색상 / 탭 글자색 / 내용 배경색 / 내용 글자색 (탭별 개별 지정) */
	var row3 = document.createElement('div');
	row3.className = 'item-row3 row-inline';

	var idTabBg    = 'tab_bg_'        + seq;
	var idTabColor = 'tab_color_'     + seq;
	var idContBg   = 'tab_cbg_'       + seq;
	var idContColor= 'tab_ccolor_'    + seq;

	row3.appendChild(createColorField(idTabBg,    idTabBg    + '_hex', '탭 색상:',     tabBg));
	row3.appendChild(createColorField(idTabColor, idTabColor + '_hex', '탭 글자색:',   tabColor));
	row3.appendChild(createColorField(idContBg,   idContBg   + '_hex', '내용 배경색:', contentBg));
	row3.appendChild(createColorField(idContColor,idContColor+ '_hex', '내용 글자색:', contentColor));

	var btnReset = document.createElement('button');
	btnReset.type = 'button';
	btnReset.className = 'btn-reset-color';
	btnReset.textContent = '기본색';
	btnReset.title = '이 탭의 위치(순서) 기준 기본 색상으로 되돌립니다';
	btnReset.addEventListener('click', (function(s) { return function() { resetTabColors(s); }; })(seq));
	row3.appendChild(btnReset);

	wrap.appendChild(row1);
	wrap.appendChild(row2);
	wrap.appendChild(row3);

	xGetElementById('tab-list').appendChild(wrap);
	bindColorPair(idTabBg,     idTabBg    + '_hex');
	bindColorPair(idTabColor,  idTabColor + '_hex');
	bindColorPair(idContBg,    idContBg   + '_hex');
	bindColorPair(idContColor, idContColor+ '_hex');
	bindDragEvents(wrap, handle);
	renumberTabItems();
	updatePreview();
}

/* 특정 탭 항목의 색상을, 현재 화면상 순서(인덱스) 기준 기본 팔레트로 되돌린다 */
function resetTabColors(seq) {
	var items = Array.prototype.slice.call(document.querySelectorAll('#tab-list > .tab-item'));
	var idx = items.findIndex(function(el) { return el.id === 'tabitem_' + seq; });
	if (idx < 0) return;
	var palette = defaultTabColorsFor(idx);

	setColorFieldValue('tab_bg_'     + seq, palette.tab_bg);
	setColorFieldValue('tab_color_'  + seq, palette.tab_color);
	setColorFieldValue('tab_cbg_'    + seq, palette.content_bg);
	setColorFieldValue('tab_ccolor_' + seq, palette.content_color);
	updatePreview();
}

function setColorFieldValue(pickerId, value) {
	var picker = xGetElementById(pickerId);
	var hex    = xGetElementById(pickerId + '_hex');
	if (picker) picker.value = value;
	if (hex) hex.value = value;
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
		var idx = arr.length;
		var palette = defaultTabColorsFor(idx);
		arr.push({
			title:         titleEl ? titleEl.value : '',
			content:       contentEl ? contentEl.value : '',
			tab_bg:        getColorValue('tab_bg_'     + id, palette.tab_bg),
			tab_color:     getColorValue('tab_color_'  + id, palette.tab_color),
			content_bg:    getColorValue('tab_cbg_'    + id, palette.content_bg),
			content_color: getColorValue('tab_ccolor_' + id, palette.content_color)
		});
	});
	return arr;
}

/* ── 라디오+레이블+패널 HTML 생성 (groupName만 다르면 실제 출력물과 100% 동일한 구조) ──
 * 탭 색상/글자색/내용 배경색/내용 글자색은 탭마다 다르므로, 각 label/panel 요소에
 * 인라인 스타일로 CSS 변수를 직접 지정한다. 탭은 선택 여부와 무관하게 항상 자기
 * 고유 색상을 유지해야 하므로, --mh_tab_inactive_bg/color와 --mh_tab_active_bg/color를
 * 모두 같은 값으로 지정한다(선택 시 색이 바뀌지 않고, mh_tab.css의 굵은 글씨 + 밑줄
 * 강조만으로 선택 상태를 표시). shape가 'slant'면 각 라벨에 경사 모양 클래스를 붙인다. */
function buildTabsMarkup(groupName, tabsArr, shape) {
	var radioHtml = '', navHtml = '', panelHtml = '';
	var shapeClass = (shape === 'slant') ? ' mh_tab_shape_slant' : '';
	tabsArr.forEach(function(tab, i) {
		var radioId = groupName + '_' + i;
		var checked = (i === 0) ? ' checked' : '';
		var title = escText(tab.title || ('탭' + (i + 1)));
		var palette = defaultTabColorsFor(i);
		var tabBg        = tab.tab_bg        || palette.tab_bg;
		var tabColor     = tab.tab_color     || palette.tab_color;
		var contentBg    = tab.content_bg    || palette.content_bg;
		var contentColor = tab.content_color || palette.content_color;
		var btnStyle   = '--mh_tab_inactive_bg:' + tabBg + ';--mh_tab_inactive_color:' + tabColor + ';'
			+ '--mh_tab_active_bg:' + tabBg + ';--mh_tab_active_color:' + tabColor + ';';
		var panelStyle = '--mh_tab_content_bg:' + contentBg + ';--mh_tab_content_color:' + contentColor + ';';

		radioHtml += '<input type="radio" class="mh_tab_radio" name="' + groupName + '" id="' + radioId + '"' + checked + ' />';
		navHtml   += '<label class="mh_tab_btn' + shapeClass + '" style="' + btnStyle + '" for="' + radioId + '">' + title + '</label>';
		panelHtml += '<div class="mh_tab_panel" style="' + panelStyle + '" data-tab-title="' + escAttr(tab.title || ('탭' + (i + 1))) + '">' + normalizeTabContent(tab.content) + '</div>';
	});
	return { radioHtml: radioHtml, navHtml: navHtml, panelHtml: panelHtml };
}

/* 전체 탭 공통(비선택 탭 색상, 폰트 크기)만 남는다. 탭별 색상은 buildTabsMarkup에서 개별 처리.
 * active_bg/active_color는 display.html(원본, 수정 불가)이 여전히 참조하는 속성이라 값만
 * 채워두지만, 실제로는 각 라벨이 자기 색을 그대로 유지하므로 화면에 쓰이지 않는다. */
function currentStyleOptions() {
	return {
		active_bg:      '#3a7abf',
		active_color:   '#ffffff',
		inactive_bg:    getColorValue('tab_inactive_bg',    '#f5f5f5'),
		inactive_color: getColorValue('tab_inactive_color', '#555555'),
		title_size:     getSizeValue('tab_title_size')   || '15px',
		content_size:   getSizeValue('tab_content_size') || '14px'
	};
}

function styleVarString(opt) {
	return '--mh_tab_active_bg:' + opt.active_bg + ';'
		+ '--mh_tab_active_color:' + opt.active_color + ';'
		+ '--mh_tab_inactive_bg:' + opt.inactive_bg + ';'
		+ '--mh_tab_inactive_color:' + opt.inactive_color + ';'
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

	var markup = buildTabsMarkup('mh_tab_group_preview', tabsArr, getShapeValue());
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
		+ '.mh_tab_btn{flex:1 1 auto;text-align:center;padding:10px 14px;background: var(--mh_tab_inactive_bg, #f5f5f5);color:var(--mh_tab_inactive_color,#555555);font-size:var(--mh_tab_title_size,15px);user-select:none;border-radius: 14px 14px 0 0;box-sizing:border-box}'
		+ '.mh_tab_btn.mh_tab_shape_slant{border-radius:0;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 100%,0 100%);padding:10px 28px 10px 14px}'
		/* 탭은 선택 여부와 무관하게 항상 자기 고유 색상을 유지하고, 선택 표시는
		 * 글자를 흰색 + 검은 그림자로 강조하는 것으로 한다(실제 사이트의 mh_tab.css와 동일한 방식) */
		+ buildNthOfTypeRules('.mh_tab_nav .mh_tab_btn', 'font-weight:600;color:#ffffff;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 2px 3px rgba(0,0,0,.55);')
		+ '.mh_tab_panels{background:transparent}'
		/* 에디터 작성 화면에서는 실제 사이트와 달리 선택되지 않은 탭도 숨기지 않고
		 * 전부 순서대로 펼쳐서 보여준다 — 그래야 각 탭 내용을 눈으로 보면서
		 * 바로 수정/추가할 수 있기 때문이다(실제 사이트 노출 방식은 front-end에서
		 * mh_tab.css가 따로 적용되어 기존처럼 선택된 탭만 보인다).
		 * 각 탭 내용을 점선 테두리의 개별 카드로 분리하고, 카드 위쪽에 색이 다른
		 * 헤더 바를 둬서 "라벨(제목) 영역"과 "실제 편집 가능한 내용 영역"이
		 * 한눈에 구분되도록 한다. */
		+ '.mh_tab_panel{display:block !important;position:relative;margin:0 0 14px;padding:0 14px 14px;border:1px dashed #c7d6e8;border-radius:8px;background:var(--mh_tab_content_bg,#fff);font-size:var(--mh_tab_content_size,14px);color:var(--mh_tab_content_color,#333333)}'
		+ '.mh_tab_panel:last-of-type{margin-bottom:0}'
		+ '.mh_tab_panel::before{content:"▸ " attr(data-tab-title) " 탭 내용 — 이 아래 영역을 클릭하여 직접 입력/수정하세요";display:block;margin:0 -14px 10px -14px;padding:8px 14px;font-size:12px;font-weight:600;color:#2e6da4;background:#eaf2fb;border-bottom:1px dashed #c7d6e8;border-radius:7px 7px 0 0}'
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
	var shape = getShapeValue();
	var opt = currentStyleOptions();
	var groupName = 'mh_tab_group_' + Math.random().toString(36).slice(2, 10);
	var markup = buildTabsMarkup(groupName, tabsArr, shape);
	/* display.html(원본, 수정 불가)의 속성 목록에는 새 옵션을 추가할 자리가 없으므로,
	 * 책갈피 모양(shape) 설정은 이 mh_tabs 하나의 속성 안에 { shape, tabs } 형태로
	 * 함께 실어 보낸다 (mh_tab.class.php에서도 동일하게 읽는다). */
	var tabsJson = JSON.stringify({ shape: shape, tabs: tabsArr });

	return '<div class="mh_tab_wrap"'
		+ ' editor_component="mh_tab"'
		+ ' mh_instance="' + groupName + '"'
		+ ' mh_tabs="' + escAttr(tabsJson) + '"'
		+ ' active_bg="' + opt.active_bg + '"'
		+ ' active_color="' + opt.active_color + '"'
		+ ' inactive_bg="' + opt.inactive_bg + '"'
		+ ' inactive_color="' + opt.inactive_color + '"'
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

	var ib = node.getAttribute('inactive_bg')    || '#f5f5f5';
	var ic = node.getAttribute('inactive_color') || '#555555';

	xGetElementById('tab_inactive_bg').value        = ib;
	xGetElementById('tab_inactive_bg_hex').value    = ib;
	xGetElementById('tab_inactive_color').value     = ic;
	xGetElementById('tab_inactive_color_hex').value = ic;

	xGetElementById('tab_title_size').value   = node.getAttribute('title_size')   || '';
	xGetElementById('tab_content_size').value = node.getAttribute('content_size') || '';

	/* 제목/내용/탭별 색상은 mh_tabs 속성(팝업에서 처음 삽입했을 때의 JSON 스냅샷)이 아니라
	 * 실제 편집 화면(DOM)에 남아있는 값을 최우선으로 읽는다. 에디터 작성 화면에서
	 * 직접 수정한 제목/내용이 있다면 그 값을 반영하기 위함이다. 탭 색상(선택 여부와
	 * 무관하게 항상 유지되는 고유 색상)은 각 label의 --mh_tab_inactive_bg/color
	 * 인라인 값에서 읽는다(옛 버전 문서라 값이 없으면 addTabItem()이 순서 기준
	 * 기본 팔레트로 채운다). 책갈피 모양은 라벨의 클래스에서 판단한다. */
	var labels = node.querySelectorAll('.mh_tab_btn');
	var panels = node.querySelectorAll('.mh_tab_panel');
	var count = Math.max(labels.length, panels.length);
	var tabsArr = [];
	var shape = 'round';

	if (count > 0) {
		shape = currentShapeFromNode(node);
		for (var i = 0; i < count; i++) {
			var label = labels[i], panel = panels[i];
			tabsArr.push({
				title:         label ? label.textContent.trim() : '',
				content:       panel ? panel.innerHTML : '',
				tab_bg:        getCssVar(label, '--mh_tab_inactive_bg'),
				tab_color:     getCssVar(label, '--mh_tab_inactive_color'),
				content_bg:    getCssVar(panel, '--mh_tab_content_bg'),
				content_color: getCssVar(panel, '--mh_tab_content_color')
			});
		}
	} else {
		/* 안전장치: 본문에서 탭 구조를 찾지 못했을 때만 mh_tabs 속성(JSON) 사용.
		 * DOM getAttribute()는 이미 HTML 엔티티를 디코딩한 상태로 반환하므로 그대로 JSON.parse 가능.
		 * { shape, tabs } 형태(신규)와 순수 배열(구버전) 양쪽을 모두 지원한다. */
		var tabsRaw = node.getAttribute('mh_tabs') || '[]';
		var parsed = null;
		try { parsed = JSON.parse(tabsRaw); } catch (e) { parsed = []; }
		if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.tabs)) {
			shape = (parsed.shape === 'slant') ? 'slant' : 'round';
			tabsArr = parsed.tabs;
		} else {
			tabsArr = Array.isArray(parsed) ? parsed : [];
		}
	}

	xGetElementById('tab_shape_round').checked = (shape !== 'slant');
	xGetElementById('tab_shape_slant').checked = (shape === 'slant');

	tabsArr.forEach(function(tab) {
		addTabItem(tab.title || '', tab.content || '', tab.tab_bg, tab.tab_color, tab.content_bg, tab.content_color);
	});

	attachLiveSync(node);
	updatePreview();
}

/* ── 초기화 ── */
(function() {
	function onLoad() {
		bindColorPair('tab_inactive_bg',    'tab_inactive_bg_hex');
		bindColorPair('tab_inactive_color', 'tab_inactive_color_hex');

		['tab_title_size', 'tab_content_size'].forEach(bindSizeInput);

		['tab_shape_round', 'tab_shape_slant'].forEach(function(id) {
			var el = xGetElementById(id);
			if (el) el.addEventListener('change', updatePreview);
		});

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
