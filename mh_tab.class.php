<?php
	/**
	 * @class  mh_tab
	 * @author 팔공산 (80san@moonhouse.co.kr)
	 * @brief  에디터에서 탭(책갈피) 형태의 콘텐츠 박스 기능 제공
	 **/

	class mh_tab extends EditorHandler {

		protected int $editor_sequence = 0;
		protected string $component_path = '';

		/* CSS의 :nth-of-type 선택자와 동일한 개수만큼만 라디오/탭 전환이 지원된다 (mh_tab.css 참고) */
		private const MAX_TABS = 20;

		/* 선택 가능한 탭(책갈피) 모양 */
		private const VALID_SHAPES = ['round', 'slant'];

		/* 탭별 기본 색상 팔레트 (0-based 인덱스). 1~3번 탭은 파스텔톤 기본색을 갖고,
		 * 4번째 탭부터는 비선택 탭 색상과 동일하게(강조 없이) 표시된다.
		 * tab_bg/tab_color는 "선택되지 않았을 때"의 탭 색상/글자색이다(선택 시에는
		 * 항상 전역 active_bg/active_color로 통일됨). 내용 배경색은 탭 색상과 같은
		 * 색조를 유지하면서 가능한 한 가장 연하게(흰색에 90% 가깝게) 만들어, 검정
		 * 글자가 뚜렷하게 잘 보이도록 한다. */
		private const DEFAULT_TAB_PALETTE = [
			['tab_bg' => '#bfe4f5', 'tab_color' => '#155a7a', 'content_bg' => '#f9fcfe', 'content_color' => '#000000'], // 1번: 파스텔 하늘색
			['tab_bg' => '#fcefa9', 'tab_color' => '#7a6600', 'content_bg' => '#fffdf6', 'content_color' => '#000000'], // 2번: 파스텔 노란색
			['tab_bg' => '#dcefa8', 'tab_color' => '#5c7a1e', 'content_bg' => '#fcfdf6', 'content_color' => '#000000'], // 3번: 파스텔 연두
		];

		public function __construct(int $editor_sequence, string $component_path) {
			$this->editor_sequence = $editor_sequence;
			$this->component_path = $component_path;
		}

		public function getPopupContent(): string {
			$tpl_path = $this->component_path . 'tpl';
			$tpl_file = 'popup.html';
			Context::set('tpl_path', $tpl_path);
			$oTemplate = TemplateHandler::getInstance();
			return $oTemplate->compile($tpl_path, $tpl_file);
		}

		private function safeColor(string $color, string $default = '#444444'): string {
			return preg_match('/^#[0-9a-fA-F]{3,6}$/', $color) ? $color : $default;
		}

		/* 14px, 1.2em, .85em, 100%, 12pt 형식만 허용. 값이 없거나 형식이 틀리면 빈 문자열(기본 CSS 크기 사용) */
		private function safeFontSize(string $size): string {
			$size = trim($size);
			return preg_match('/^\d+(\.\d+)?(px|em|rem|%|pt)$/', $size) ? $size : '';
		}

		/* 탭 인덱스별 기본 색상(탭 색상/글자색/내용 배경/내용 글자색)을 반환.
		 * 0~2번(1~3번째 탭)은 고정 파스텔 팔레트, 그 외는 비선택 탭 색상과 동일하게 맞춘다. */
		private function defaultTabColors(int $idx, string $inactive_bg, string $inactive_color): array {
			return self::DEFAULT_TAB_PALETTE[$idx] ?? [
				'tab_bg'        => $inactive_bg,
				'tab_color'     => $inactive_color,
				'content_bg'    => '#ffffff',
				'content_color' => '#000000',
			];
		}

		/* 표시할 수 있는 탭(책갈피) 모양별 검증 */
		private function safeShape(string $shape): string {
			return in_array($shape, self::VALID_SHAPES, true) ? $shape : 'round';
		}

		public function transHTML($xml_obj): string {
			/* display.html(원본, 수정 불가)이 여전히 참조하는 값이라 남겨두지만,
			 * 선택 시 색상이 탭 고유색과 어긋나 보인다는 피드백에 따라 더 이상
			 * 실제 배경/글자색 전환에는 사용하지 않는다(고정값으로만 채워둠).
			 * 탭은 선택 여부와 무관하게 항상 자기 고유 색상(tab_bg/tab_color)을
			 * 유지하고, 선택 표시는 mh_tab.css의 굵은 글씨 + 밑줄 강조로 대신한다. */
			$active_bg      = '#3a7abf';
			$active_color   = '#ffffff';
			/* 비선택 탭의 기본(전역) 색상 — 탭별 색상이 지정되지 않은 4번째 탭부터 여기로 대체된다 */
			$inactive_bg    = $this->safeColor($xml_obj->attrs->inactive_bg    ?? '', '#f5f5f5');
			$inactive_color = $this->safeColor($xml_obj->attrs->inactive_color ?? '', '#555555');

			$title_size   = $this->safeFontSize($xml_obj->attrs->title_size   ?? '');
			$content_size = $this->safeFontSize($xml_obj->attrs->content_size ?? '');

			/* 탭 데이터(JSON)는 속성에 저장될 때 HTML 엔티티로 인코딩되어 있으므로
			 * json_decode 전에 반드시 html_entity_decode를 먼저 적용해야 한다.
			 * display.html(원본, 수정 불가)의 속성 목록에는 새 옵션을 추가할 자리가
			 * 없으므로, 책갈피 모양(tab_shape) 설정은 이 mh_tabs 하나의 속성 안에
			 * { "shape": "round"|"slant", "tabs": [...] } 형태로 함께 실어 보낸다.
			 * 이전 버전 문서(순수 배열 형태)와의 호환을 위해 배열이면 그대로 탭
			 * 목록으로, 객체(shape/tabs 포함)면 각각 분리해서 읽는다. */
			$tabs_raw  = $xml_obj->attrs->mh_tabs ?? '';
			$tabs_json = html_entity_decode((string) $tabs_raw, ENT_QUOTES, 'UTF-8');
			$decoded   = json_decode($tabs_json, true);

			if (is_array($decoded) && isset($decoded['tabs']) && is_array($decoded['tabs'])) {
				$tabs      = $decoded['tabs'];
				$tab_shape = $this->safeShape((string) ($decoded['shape'] ?? 'round'));
			} else {
				$tabs      = is_array($decoded) ? $decoded : [];
				$tab_shape = 'round';
			}
			$shape_class = ($tab_shape === 'slant') ? ' mh_tab_shape_slant' : '';
			$tabs = array_slice($tabs, 0, self::MAX_TABS);

			$nav_html   = '';
			$panel_html = '';
			$radio_html = '';
			$group_name = 'mh_tab_group_' . substr(md5($tabs_json . microtime()), 0, 10);

			foreach ($tabs as $idx => $tab) {
				$title   = htmlspecialchars((string) ($tab['title'] ?? ''), ENT_QUOTES, 'UTF-8');
				/* 내용은 사용자가 직접 입력한 HTML을 그대로 출력한다 (에스케이프하지 않음) */
				$content = (string) ($tab['content'] ?? '');
				$radio_id = $group_name . '_' . $idx;
				$checked  = ($idx === 0) ? ' checked' : '';

				/* 탭별 색상: 값이 없거나 형식이 틀리면 인덱스 기본 팔레트로 대체.
				 * tab_bg/tab_color는 선택 여부와 무관하게 항상 유지되는 탭 고유 색상이다. */
				$default_colors = $this->defaultTabColors((int) $idx, $inactive_bg, $inactive_color);
				$tab_bg         = $this->safeColor((string) ($tab['tab_bg']        ?? ''), $default_colors['tab_bg']);
				$tab_color      = $this->safeColor((string) ($tab['tab_color']     ?? ''), $default_colors['tab_color']);
				$content_bg     = $this->safeColor((string) ($tab['content_bg']    ?? ''), $default_colors['content_bg']);
				$content_color  = $this->safeColor((string) ($tab['content_color'] ?? ''), $default_colors['content_color']);

				$btn_style   = '--mh_tab_inactive_bg:' . $tab_bg . ';--mh_tab_inactive_color:' . $tab_color . ';';
				$panel_style = '--mh_tab_content_bg:' . $content_bg . ';--mh_tab_content_color:' . $content_color . ';';

				$radio_html .= '<input type="radio" class="mh_tab_radio" name="' . $group_name . '" id="' . $radio_id . '"' . $checked . ' />';
				$nav_html   .= '<label class="mh_tab_btn' . $shape_class . '" style="' . $btn_style . '" for="' . $radio_id . '">' . $title . '</label>';
				$panel_html .= '<div class="mh_tab_panel" style="' . $panel_style . '">' . $content . '</div>';
			}

			$tab_info = new stdClass();
			$tab_info->radio_html     = $radio_html;
			$tab_info->nav_html       = $nav_html;
			$tab_info->panel_html     = $panel_html;
			$tab_info->active_bg      = $active_bg;
			$tab_info->active_color   = $active_color;
			$tab_info->content_bg     = '#ffffff';
			$tab_info->content_color  = '#333333';
			$tab_info->inactive_bg    = $inactive_bg;
			$tab_info->inactive_color = $inactive_color;
			$tab_info->title_size     = $title_size   ?: '15px';
			$tab_info->content_size   = $content_size ?: '14px';
			$tab_info->mh_tabs_attr   = htmlspecialchars($tabs_json, ENT_QUOTES, 'UTF-8');

			Context::set('tab_info', $tab_info);

			$tpl_path = $this->component_path . 'tpl';
			Context::set('tpl_path', $tpl_path);

			$oTemplate = TemplateHandler::getInstance();
			return $oTemplate->compile($tpl_path, 'display.html');
		}
	}
?>
