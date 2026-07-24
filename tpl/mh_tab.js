/**
 * mh_tab 자동 전환 스크립트
 * display.html의 <load target="mh_tab.js" /> 를 통해 정적 파일로 로드된다
 * (게시글 본문에 직접 삽입하는 <script> 태그는 저장 시 필터에 의해 제거되므로,
 * mh_before와 동일하게 외부 정적 파일로 분리했다).
 *
 * 중요: display.html은 서버에서 화면을 그릴 때마다 새로 컴파일되며, 이 템플릿에는
 * mh_autoplay/mh_interval 같은 별도 속성을 추가할 자리가 없다(수정 금지 파일이라
 * 새 속성을 추가할 수 없고, 추가해도 다시 그릴 때 사라진다). 대신 mh_tabs 속성
 * 안의 JSON({shape, autoplay, interval, tabs})은 display.html이 이미 출력하고
 * 있으므로, 자동전환 여부/간격은 반드시 이 JSON에서 읽어야 한다.
 *
 * 페이지 안의 모든 .mh_tab_wrap 요소를 찾아, mh_tabs JSON의 autoplay가 true인
 * 것만 지정된 interval(초)마다 다음 탭으로 자동 전환한다.
 * 탭을 한 번이라도 직접 클릭하면 그 탭 박스의 자동 전환은 멈춘다.
 */
(function() {
	function initAutoplay(wrap) {
		if (wrap.getAttribute('mh_autoplay_inited') === '1') return;

		var data;
		try {
			data = JSON.parse(wrap.getAttribute('mh_tabs') || '{}');
		} catch (e) {
			return;
		}
		if (!data || !data.autoplay) return;

		wrap.setAttribute('mh_autoplay_inited', '1');

		var interval = parseInt(data.interval, 10);
		if (!interval || interval < 1) interval = 5;

		var radios = wrap.querySelectorAll('.mh_tab_radio');
		if (radios.length < 2) return;

		var timer = null;

		function advance() {
			var idx = -1;
			for (var i = 0; i < radios.length; i++) {
				if (radios[i].checked) { idx = i; break; }
			}
			var next = (idx + 1) % radios.length;
			radios[next].checked = true;
		}

		function stop() {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		}

		var btns = wrap.querySelectorAll('.mh_tab_btn');
		for (var i = 0; i < btns.length; i++) {
			btns[i].addEventListener('click', stop, { once: true });
		}

		timer = setInterval(advance, interval * 1000);
	}

	function initAll() {
		var wraps = document.querySelectorAll('.mh_tab_wrap');
		for (var i = 0; i < wraps.length; i++) {
			initAutoplay(wraps[i]);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initAll);
	} else {
		initAll();
	}
})();
