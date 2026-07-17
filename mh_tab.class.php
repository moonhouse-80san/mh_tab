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

		public function transHTML($xml_obj): string {
			$active_bg      = $this->safeColor($xml_obj->attrs->active_bg      ?? '', '#3a7abf');
			$active_color   = $this->safeColor($xml_obj->attrs->active_color   ?? '', '#ffffff');
			$inactive_bg    = $this->safeColor($xml_obj->attrs->inactive_bg    ?? '', '#f5f5f5');
			$inactive_color = $this->safeColor($xml_obj->attrs->inactive_color ?? '', '#555555');
			$content_color  = $this->safeColor($xml_obj->attrs->content_color  ?? '', '#333333');
			$content_bg     = $this->safeColor($xml_obj->attrs->content_bg     ?? '', '#ffffff');

			$title_size   = $this->safeFontSize($xml_obj->attrs->title_size   ?? '');
			$content_size = $this->safeFontSize($xml_obj->attrs->content_size ?? '');

			/* 탭 데이터(JSON)는 속성에 저장될 때 HTML 엔티티로 인코딩되어 있으므로
			 * json_decode 전에 반드시 html_entity_decode를 먼저 적용해야 한다. */
			$tabs_raw  = $xml_obj->attrs->mh_tabs ?? '';
			$tabs_json = html_entity_decode((string) $tabs_raw, ENT_QUOTES, 'UTF-8');
			$tabs      = json_decode($tabs_json, true);
			if (!is_array($tabs)) {
				$tabs = [];
			}
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

				$radio_html .= '<input type="radio" class="mh_tab_radio" name="' . $group_name . '" id="' . $radio_id . '"' . $checked . ' />';
				$nav_html   .= '<label class="mh_tab_btn" for="' . $radio_id . '">' . $title . '</label>';
				$panel_html .= '<div class="mh_tab_panel">' . $content . '</div>';
			}

			$tab_info = new stdClass();
			$tab_info->radio_html     = $radio_html;
			$tab_info->nav_html       = $nav_html;
			$tab_info->panel_html     = $panel_html;
			$tab_info->active_bg      = $active_bg;
			$tab_info->active_color   = $active_color;
			$tab_info->inactive_bg    = $inactive_bg;
			$tab_info->inactive_color = $inactive_color;
			$tab_info->content_color  = $content_color;
			$tab_info->content_bg     = $content_bg;
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
