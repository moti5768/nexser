// template.js
// スプレッドシートアプリの静的UI骨格HTML（リボン・数式バー・テーブル・シートタブバー）

export const SPREADSHEET_TEMPLATE_HTML = `
    <div class="nexser-spreadsheet-app" tabindex="-1">
        <!-- Excel準拠 クイックアクセスツールバー ＆ リボンUI -->
        <div class="ss-ribbon-shell">
            <div class="ss-qat-and-tabs">
                <div class="ss-ribbon-tabs">
                    <div class="pulldown_menu_parent">
                        <span class="ss-ribbon-tab pulldown_btn" style="background:#0b5a2f;">ファイル</span>
                        <ul class="pulldown_menu" style="min-width:210px;">
                            <li class="button" data-action="new">新規作成</li>
                            <li class="button" data-action="open">開く...</li>
                            <li class="button" data-action="import-local">ローカルファイルから開く (.nxs / .csv)...</li>
                            <li class="ss-menu-sep"></li>
                           <li class="button" data-action="save">上書き保存 (Ctrl+S)</li>
                            <li class="button" data-action="save-as">名前を付けて保存 (仮想ドライブ)...</li>
                            <li class="button" data-action="export-nxs">NXS形式でエクスポート (PCへダウンロード)</li>
                            <li class="button" data-action="export-csv">CSV形式でエクスポート (仮想ドライブ)</li>
                            <li class="button" data-action="export-csv-local">CSV形式でエクスポート (PCへダウンロード)</li>
                            <li class="ss-menu-sep"></li>
                            <li class="button" data-action="print">印刷</li>
                        </ul>
                    </div>
                    <span class="ss-ribbon-tab active" data-ribbon-tab="home">ホーム</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="insert">挿入</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="pagelayout">ページレイアウト</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="formulas">数式</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="data">データ</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="view">表示</span>
                </div>
                <!-- クイックアクセスツールバー -->
                <div class="ss-qat-bar" title="クイックアクセスツールバー">
                    <span class="ss-qat-btn" data-action="save" title="上書き保存 (Ctrl+S)">💾 保存</span>
                    <span class="ss-qat-btn ss-qat-undo" data-action="undo" title="元に戻す (Ctrl+Z)">↶ 戻す</span>
                    <span class="ss-qat-btn ss-qat-redo" data-action="redo" title="やり直し (Ctrl+Y)">↷ やり直し</span>
                    <span class="ss-qat-btn ss-ribbon-collapse-btn" data-action="toggle-ribbon" title="リボンの折りたたみ/展開">▲</span>
                </div>
            </div>

            <div class="ss-ribbon-panels">
                <!-- ==================== [ホーム] タブ（7グループ構成・Excel準拠スリム） ==================== -->
                <div class="ss-ribbon-panel active" data-ribbon-panel="home">
                    <!-- 1. クリップボード -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large" title="貼り付けオプション">
                                    <span class="ss-btn-ico-lg">📋</span>
                                    <span class="ss-btn-lbl">貼付▼</span>
                                </span>
                                <ul class="pulldown_menu" style="min-width:195px;">
                                    <li class="button" data-action="paste">貼り付け (Ctrl+V)</li>
                                    <li class="button" data-action="paste-values">値のみ貼り付け (Ctrl+Shift+V)</li>
                                    <li class="button" data-action="paste-formats">書式のみ貼り付け</li>
                                    <li class="button" data-action="paste-transpose">行列を入れ替えて貼り付け</li>
                                </ul>
                            </div>
                            <div class="ss-ribbon-col ss-ribbon-col-stack">
                                <span class="button" data-action="cut" title="切り取り (Ctrl+X)">✂ 切取</span>
                                <span class="button" data-action="copy" title="コピー (Ctrl+C)">📄 コピー</span>
                                <span class="button ss-format-painter-btn" data-action="format-painter" title="書式のコピー/貼り付け">🖌 書式</span>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">クリップボード</div>
                    </div>

                    <!-- 2. フォント -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="ss-ribbon-col">
                                <div class="ss-ribbon-row">
                                    <label>
                                        <select class="ss-font-family" style="outline:none; width:108px;" title="フォント">
                                            <option value="'MS PGothic', 'MS Gothic', sans-serif" selected>MS Pゴシック</option>
                                            <option value="'Meiryo', 'メイリオ', sans-serif">メイリオ</option>
                                            <option value="'Yu Gothic', '游ゴシック', sans-serif">游ゴシック</option>
                                            <option value="'MS PMincho', 'MS Mincho', serif">MS P明朝</option>
                                            <option value="'Yu Mincho', '游明朝', serif">游明朝</option>
                                            <option value="Arial, Helvetica, sans-serif">Arial</option>
                                            <option value="Consolas, 'Courier New', monospace">Consolas</option>
                                        </select>
                                    </label>
                                    <label>
                                        <select class="ss-font-size" style="outline:none; width:44px;" title="フォントサイズ">
                                            <option value="8px">8</option>
                                            <option value="9px">9</option>
                                            <option value="10px">10</option>
                                            <option value="11px">11</option>
                                            <option value="12px">12</option>
                                            <option value="14px" selected>14</option>
                                            <option value="16px">16</option>
                                            <option value="18px">18</option>
                                            <option value="20px">20</option>
                                            <option value="24px">24</option>
                                            <option value="26px">26</option>
                                            <option value="28px">28</option>
                                            <option value="36px">36</option>
                                            <option value="48px">48</option>
                                            <option value="72px">72</option>
                                            <option value="96px">96</option>
                                            <option value="120px">120</option>
                                            <option value="144px">144</option>
                                        </select>
                                    </label>
                                </div>
                                <div class="ss-ribbon-row">
                                    <span class="button ss-icon-btn ss-toggle-bold" title="太字">B</span>
                                    <span class="button ss-icon-btn ss-toggle-italic" style="font-style:italic; font-weight:bold;" title="斜体">i</span>
                                    <span class="button ss-icon-btn ss-toggle-underline" title="下線"><span style="text-decoration:underline;">U</span></span>
                                    <span class="button ss-icon-btn ss-toggle-strike" title="取り消し線"><span style="text-decoration:line-through;">S</span></span>
                                    <span class="button ss-icon-btn ss-toggle-textshadow" title="影付き"><span style="text-shadow:2px 2px #555;">A</span></span>
                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn" title="罫線">罫▼</span>
                                        <ul class="pulldown_menu" style="min-width:178px;">
                                            <li style="padding:3px 4px; display:flex; flex-direction:column; gap:4px; border-bottom:1px solid #808080; margin-bottom:3px;">
                                                <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; font-size:11px;">
                                                    <span>線種:</span>
                                                    <select class="ss-border-style-select" style="height:20px; font-size:11px; flex:1;">
                                                        <option value="1px solid">細実線</option>
                                                        <option value="2px solid" selected>実線 (標準)</option>
                                                        <option value="4px solid">太実線</option>
                                                        <option value="3px double">二重線</option>
                                                        <option value="2px dashed">破線</option>
                                                        <option value="2px dotted">点線</option>
                                                    </select>
                                                </div>
                                                <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; font-size:11px;">
                                                    <span>線の色:</span>
                                                    <input type="color" class="ss-border-color-input" value="#000000" style="width:48px; height:20px; padding:0; border:1px solid #666;">
                                                </div>
                                            </li>
                                            <li class="button" data-border="top">上罫線</li>
                                            <li class="button" data-border="bottom">下罫線</li>
                                            <li class="button" data-border="bottom-double">下二重罫線</li>
                                            <li class="button" data-border="left">左罫線</li>
                                            <li class="button" data-border="right">右罫線</li>
                                            <li class="button" data-border="outer">外枠</li>
                                            <li class="button" data-border="outer-bold">太い外枠</li>
                                            <li class="button" data-border="cell">格子（セル枠）</li>
                                            <li class="button" data-border="none">枠線なし</li>
                                        </ul>
                                    </div>
                                    <div class="ss-cell-color-palette pulldown_menu_parent">
                                        <span class="button pulldown_btn" style="background-color:#222; color:#fff;" title="塗りつぶしの色">塗▼</span>
                                        <div class="pulldown_menu">
                                            <div class="swatch-container">
                                                <div class="color-swatch" data-color="#000000" style="background-color:#000000;"></div>
                                                <div class="color-swatch" data-color="#FF0000" style="background-color:#FF0000;"></div>
                                                <div class="color-swatch" data-color="#00FF00" style="background-color:#00FF00;"></div>
                                                <div class="color-swatch" data-color="#0000FF" style="background-color:#0000FF;"></div>
                                                <div class="color-swatch" data-color="#FFFF00" style="background-color:#FFFF00;"></div>
                                                <div class="color-swatch" data-color="#FF00FF" style="background-color:#FF00FF;"></div>
                                                <div class="color-swatch" data-color="#00FFFF" style="background-color:#00FFFF;"></div>
                                                <div class="color-swatch" data-color="#808080" style="background-color:#808080;"></div>
                                                <div class="color-swatch" data-color="#800000" style="background-color:#800000;"></div>
                                                <div class="color-swatch" data-color="#008000" style="background-color:#008000;"></div>
                                                <div class="color-swatch" data-color="#000080" style="background-color:#000080;"></div>
                                                <div class="color-swatch" data-color="#808000" style="background-color:#808000;"></div>
                                                <div class="color-swatch" data-color="#800080" style="background-color:#800080;"></div>
                                                <div class="color-swatch" data-color="#008080" style="background-color:#008080;"></div>
                                                <div class="color-swatch" data-color="#C0C0C0" style="background-color:#C0C0C0;"></div>
                                                <div class="color-swatch" data-color="#FFFFFF" style="background-color:#FFFFFF;"></div>
                                            </div>
                                            <div class="color-swatch button" data-color="none">塗りつぶしなし</div>
                                            <div class="ss-color-picker">
                                                <label>詳細: <input type="color" class="ss-cell-color-custom"></label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="ss-text-color-palette pulldown_menu_parent">
                                        <span class="button pulldown_btn" style="color:#d00;" title="フォントの色">A▼</span>
                                        <div class="pulldown_menu">
                                            <div class="swatch-container">
                                                <div class="color-swatch" data-color="#000000" style="background-color:#000000;"></div>
                                                <div class="color-swatch" data-color="#FF0000" style="background-color:#FF0000;"></div>
                                                <div class="color-swatch" data-color="#00FF00" style="background-color:#00FF00;"></div>
                                                <div class="color-swatch" data-color="#0000FF" style="background-color:#0000FF;"></div>
                                                <div class="color-swatch" data-color="#FFFF00" style="background-color:#FFFF00;"></div>
                                                <div class="color-swatch" data-color="#FF00FF" style="background-color:#FF00FF;"></div>
                                                <div class="color-swatch" data-color="#00FFFF" style="background-color:#00FFFF;"></div>
                                                <div class="color-swatch" data-color="#808080" style="background-color:#808080;"></div>
                                                <div class="color-swatch" data-color="#800000" style="background-color:#800000;"></div>
                                                <div class="color-swatch" data-color="#008000" style="background-color:#008000;"></div>
                                                <div class="color-swatch" data-color="#000080" style="background-color:#000080;"></div>
                                                <div class="color-swatch" data-color="#808000" style="background-color:#808000;"></div>
                                                <div class="color-swatch" data-color="#800080" style="background-color:#800080;"></div>
                                                <div class="color-swatch" data-color="#008080" style="background-color:#008080;"></div>
                                                <div class="color-swatch" data-color="#C0C0C0" style="background-color:#C0C0C0;"></div>
                                                <div class="color-swatch" data-color="#FFFFFF" style="background-color:#FFFFFF;"></div>
                                            </div>
                                            <div class="color-swatch button" data-color="none">自動</div>
                                            <div class="ss-color-picker">
                                                <label>詳細: <input type="color" class="ss-text-color-custom"></label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">フォント</div>
                    </div>

                    <!-- 3. 配置 -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="ss-ribbon-col">
                                <!-- 上段：上下揃えアイコン + 縦書き -->
                                <div class="ss-ribbon-row">
                                    <span class="button ss-icon-btn ss-valign-top" title="上揃え">
                                        <svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true">
                                            <path d="M2 2.5h12M2 5.5h8M2 8.5h10"/>
                                        </svg>
                                    </span>
                                    <span class="button ss-icon-btn ss-valign-middle" title="上下中央揃え">
                                        <svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true">
                                            <path d="M2 5h12M2 8h8M2 11h10"/>
                                        </svg>
                                    </span>
                                    <span class="button ss-icon-btn ss-valign-bottom" title="下揃え">
                                        <svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true">
                                            <path d="M2 7.5h12M2 10.5h8M2 13.5h10"/>
                                        </svg>
                                    </span>
                                    <span class="button ss-icon-btn ss-toggle-vertical" title="縦書き / 横書き切替">縦</span>
                                </div>
                                <!-- 下段：左右揃え + 均等割り付けアイコン -->
                                <div class="ss-ribbon-row ss-text-alignment-buttons">
                                    <span class="button ss-icon-btn" data-align="left" title="左揃え">
                                        <svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true">
                                            <path d="M2 3h12M2 6.3h8M2 9.7h12M2 13h9"/>
                                        </svg>
                                    </span>
                                    <span class="button ss-icon-btn" data-align="center" title="中央揃え">
                                        <svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true">
                                            <path d="M2 3h12M4 6.3h8M2 9.7h12M3.5 13h9"/>
                                        </svg>
                                    </span>
                                    <span class="button ss-icon-btn" data-align="right" title="右揃え">
                                        <svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true">
                                            <path d="M2 3h12M6 6.3h8M2 9.7h12M5 13h9"/>
                                        </svg>
                                    </span>
                                    <span class="button ss-icon-btn" data-align="justify" title="均等割り付け（文字の間隔を均等に揃える）">
                                        <svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true">
                                            <path d="M2 3h12M2 6.5h12M2.5 11.5h11M5 9.5L2.5 11.5L5 13.5M11 9.5L13.5 11.5L11 13.5"/>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div class="ss-ribbon-vsep"></div>
                            <div class="ss-ribbon-col">
                                <div class="ss-ribbon-row">
                                    <span class="button ss-icon-btn" data-action="indent-dec" title="インデントを減らす">⇤</span>
                                    <span class="button ss-icon-btn" data-action="indent-inc" title="インデントを増やす">⇥</span>
                                    <span class="button ss-toggle-wrap" title="折り返して全体を表示する">↩折返</span>
                                </div>
                                <div class="ss-ribbon-row">
                                    <span class="button ss-merge-cells" title="セルを結合して中央揃え">結合</span>
                                    <span class="button ss-unmerge-cells" title="セル結合の解除">解除</span>
                                    <span class="button ss-icon-btn" data-action="format-cells" title="セルの書式設定 (Ctrl+1)">⚙</span>
                                </div>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">配置</div>
                    </div>

                    <!-- 4. 数値 -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="ss-ribbon-col">
                                <div class="ss-ribbon-row">
                                    <span class="button" data-numfmt="general" title="標準表示">標準</span>
                                    <span class="button" data-numfmt="date-jp" title="日付表示 (2025年7月8日)">日付</span>
                                    <span class="button" data-numfmt="date-md" title="短い日付 (7/8)">M/D</span>
                                    <span class="button" data-action="custom-numfmt" title="ユーザー定義の表示形式を設定 (例: #,##0&quot;円&quot;)">詳細</span>
                                </div>
                                <div class="ss-ribbon-row">
                                    <span class="button ss-icon-btn" data-numfmt="currency" title="通貨表示形式 (¥1,000)">¥</span>
                                    <span class="button ss-icon-btn" data-numfmt="percent" title="パーセントスタイル (10%)">%</span>
                                    <span class="button ss-icon-btn" data-numfmt="comma" title="桁区切りスタイル (1,000)">,</span>
                                    <span class="button" data-decimal-step="1" title="小数点以下の表示桁数を増やす">.0+</span>
                                    <span class="button" data-decimal-step="-1" title="小数点以下の表示桁数を減らす">.0-</span>
                                </div>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">数値</div>
                    </div>

                    <!-- 5. スタイル -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large" title="条件付き書式">
                                    <span class="ss-btn-ico-lg">📊</span>
                                    <span class="ss-btn-lbl">条件付<br>書式▼</span>
                                </span>
                                <ul class="pulldown_menu" style="min-width:225px; overflow:visible;">
                                    <li class="button ss-submenu-parent">
                                        <span>セルの強調表示ルール(H)</span><span>▶</span>
                                        <ul class="ss-submenu">
                                            <li class="button" data-cf-preset="highlight-gt">指定の値より大きい(G)...</li>
                                            <li class="button" data-cf-preset="highlight-lt">指定の値より小さい(L)...</li>
                                            <li class="button" data-cf-preset="highlight-between">指定の範囲内(B)...</li>
                                            <li class="button" data-cf-preset="highlight-eq">指定の値に等しい(E)...</li>
                                            <li class="button" data-cf-preset="highlight-text">文字列(T)...</li>
                                            <li class="button" data-cf-preset="highlight-date">日付(A)...</li>
                                            <li class="button" data-cf-preset="highlight-dup">重複する値(D)...</li>
                                        </ul>
                                    </li>
                                    <li class="button ss-submenu-parent">
                                        <span>上位/下位ルール(T)</span><span>▶</span>
                                        <ul class="ss-submenu">
                                            <li class="button" data-cf-preset="top-n">上位 10 項目(T)...</li>
                                            <li class="button" data-cf-preset="top-pct">上位 10 %(P)...</li>
                                            <li class="button" data-cf-preset="bottom-n">下位 10 項目(B)...</li>
                                            <li class="button" data-cf-preset="bottom-pct">下位 10 %(O)...</li>
                                            <li class="button" data-cf-preset="above-avg">平均より上(A)...</li>
                                            <li class="button" data-cf-preset="below-avg">平均より下(V)...</li>
                                        </ul>
                                    </li>
                                    <li class="button ss-submenu-parent">
                                        <span>データ バー(D)</span><span>▶</span>
                                        <ul class="ss-submenu">
                                            <li class="button" data-cf-preset="databar-grad-blue">グラデーション: 青のデータ バー</li>
                                            <li class="button" data-cf-preset="databar-grad-green">グラデーション: 緑のデータ バー</li>
                                            <li class="button" data-cf-preset="databar-grad-red">グラデーション: 赤のデータ バー</li>
                                            <li class="button" data-cf-preset="databar-grad-orange">グラデーション: オレンジのデータ バー</li>
                                            <li class="ss-menu-sep"></li>
                                            <li class="button" data-cf-preset="databar-solid-blue">単色: 青のデータ バー</li>
                                            <li class="button" data-cf-preset="databar-solid-green">単色: 緑のデータ バー</li>
                                            <li class="button" data-cf-preset="databar-solid-red">単色: 赤のデータ バー</li>
                                            <li class="button" data-cf-preset="databar-solid-orange">単色: オレンジのデータ バー</li>
                                        </ul>
                                    </li>
                                    <li class="button ss-submenu-parent">
                                        <span>カラー スケール(S)</span><span>▶</span>
                                        <ul class="ss-submenu">
                                            <li class="button" data-cf-preset="scale-gyr">緑 - 黄 - 赤のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-ryg">赤 - 黄 - 緑のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-gwr">緑 - 白 - 赤のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-rwg">赤 - 白 - 緑のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-bwr">青 - 白 - 赤のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-rwb">赤 - 白 - 青のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-wr">白 - 赤のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-rw">赤 - 白のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-gw">緑 - 白のカラー スケール</li>
                                            <li class="button" data-cf-preset="scale-wg">白 - 緑のカラー スケール</li>
                                        </ul>
                                    </li>
                                    <li class="button ss-submenu-parent">
                                        <span>アイコン セット(I)</span><span>▶</span>
                                        <ul class="ss-submenu">
                                            <li class="button" data-cf-preset="icon-arrows3">方向: 3方向矢印（カラー）</li>
                                            <li class="button" data-cf-preset="icon-traffic3">図形: 3つの信号（枠なし）</li>
                                            <li class="button" data-cf-preset="icon-signs3">インジケーター: 3つの記号（丸付き）</li>
                                            <li class="button" data-cf-preset="icon-stars3">評価: 3つの星</li>
                                        </ul>
                                    </li>
                                    <li class="ss-menu-sep"></li>
                                    <li class="button" data-cf-preset="custom">新しいルール(N)...</li>
                                    <li class="button ss-submenu-parent">
                                        <span>ルールのクリア(C)</span><span>▶</span>
                                        <ul class="ss-submenu">
                                            <li class="button" data-cf-preset="clear-selection">選択したセルからルールをクリア(S)</li>
                                            <li class="button" data-cf-preset="clear-sheet">シート全体からルールをクリア(E)</li>
                                        </ul>
                                    </li>
                                    <li class="button" data-cf-preset="manage">ルールの管理(R)...</li>
                                </ul>
                            </div>
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large" title="テーブルとして書式設定">
                                    <span class="ss-btn-ico-lg">▦</span>
                                    <span class="ss-btn-lbl">表の<br>書式▼</span>
                                </span>
                                <div class="pulldown_menu ss-table-style-menu" style="min-width:265px; padding:6px;">
                                    <div style="display:flex; gap:10px; margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid #808080; font-size:11px;">
                                        <label style="cursor:pointer;"><input type="checkbox" class="ss-tbl-opt-header" checked> 先頭行を見出しにする</label>
                                        <label style="cursor:pointer;"><input type="checkbox" class="ss-tbl-opt-stripe" checked> 縞模様</label>
                                    </div>
                                    <div style="font-size:10px; color:#333; margin-bottom:2px;">淡色・中間・濃色スタイル（12種）</div>
                                    <div class="ss-table-presets-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px;"></div>
                                </div>
                            </div>
                            <span class="button ss-btn-large" data-action="auto-format" title="サンプルイメージから選んで表にデザインを一括適用">
                                <span class="ss-btn-ico-lg">🎨</span>
                                <span class="ss-btn-lbl">自動<br>書式</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">スタイル</div>
                    </div>

                    <!-- 6. セル -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large" title="行・列・シートの挿入">
                                    <span class="ss-btn-ico-lg">➕</span>
                                    <span class="ss-btn-lbl">挿入▼</span>
                                </span>
                                <ul class="pulldown_menu" style="min-width:155px;">
                                    <li class="button" data-rowcol-op="insert-row">シートの行を挿入</li>
                                    <li class="button" data-rowcol-op="insert-col">シートの列を挿入</li>
                                    <li class="button" data-action="add-sheet">シートの挿入</li>
                                </ul>
                            </div>
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large" title="行・列・シートの削除">
                                    <span class="ss-btn-ico-lg">➖</span>
                                    <span class="ss-btn-lbl">削除▼</span>
                                </span>
                                <ul class="pulldown_menu" style="min-width:155px;">
                                    <li class="button" data-rowcol-op="delete-row">シートの行を削除</li>
                                    <li class="button" data-rowcol-op="delete-col">シートの列を削除</li>
                                    <li class="button" data-action="delete-sheet">シートの削除</li>
                                </ul>
                            </div>
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large" title="セルの書式・行高・列幅・非表示・シート保護">
                                    <span class="ss-btn-ico-lg">📐</span>
                                    <span class="ss-btn-lbl">書式▼</span>
                                </span>
                                <ul class="pulldown_menu" style="min-width:205px;">
                                    <li class="button" data-action="row-height">行の高さ(H)...</li>
                                    <li class="button" data-action="autofit-row">行の高さの自動調整(A)</li>
                                    <li class="button" data-action="col-width">列の幅(W)...</li>
                                    <li class="button" data-action="autofit-col">列幅の自動調整(I)</li>
                                    <li class="ss-menu-sep"></li>
                                    <li class="button" data-action="hide-rows">行を表示しない</li>
                                    <li class="button" data-action="unhide-rows">行の再表示</li>
                                    <li class="button" data-action="hide-cols">列を表示しない</li>
                                    <li class="button" data-action="unhide-cols">列の再表示</li>
                                    <li class="ss-menu-sep"></li>
                                    <li class="button" data-action="rename-sheet">シート名の変更...</li>
                                    <li class="button ss-protect-sheet-menu-item" data-action="toggle-sheet-protect">🔒 シートの保護...</li>
                                    <li class="ss-menu-sep"></li>
                                    <li class="button" data-action="format-cells">セルの書式設定(E)... (Ctrl+1)</li>
                                </ul>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">セル</div>
                    </div>

                    <!-- 7. 編集 -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="ss-ribbon-col">
                                <span class="button" data-action="auto-sum" title="オートSUM">Σ合計</span>
                                <div class="pulldown_menu_parent" style="width:100%;">
                                    <span class="button pulldown_btn" style="width:100%;" title="選択範囲をクリア">ｸﾘｱ▼</span>
                                    <ul class="pulldown_menu" style="min-width:175px;">
                                        <li class="button" data-action="clear-all">すべてクリア</li>
                                        <li class="button" data-action="clear-formats">書式のクリア</li>
                                        <li class="button" data-action="clear-cells">数式と値のクリア</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large" title="並べ替え">
                                    <span class="ss-btn-ico-lg">⇅</span>
                                    <span class="ss-btn-lbl">並替▼</span>
                                </span>
                                <ul class="pulldown_menu" style="min-width:165px;">
                                    <li class="button" data-sort="asc">昇順 (A→Z / 小→大)</li>
                                    <li class="button" data-sort="desc">降順 (Z→A / 大→小)</li>
                                </ul>
                            </div>
                            <span class="button ss-btn-large" data-action="find-replace" title="検索と置換 (Ctrl+F)">
                                <span class="ss-btn-ico-lg">🔍</span>
                                <span class="ss-btn-lbl">検索<br>選択</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">編集</div>
                    </div>
                </div>

                <!-- ==================== [挿入] タブ ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="insert">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="pivot-table" title="選択範囲からピボットテーブルを作成">
                                <span class="ss-btn-ico-lg">📑</span>
                                <span class="ss-btn-lbl">ピボット</span>
                            </span>
                            <span class="button ss-btn-large" data-action="create-table" title="選択範囲を構造化テーブルに変換 (Ctrl+T)">
                                <span class="ss-btn-ico-lg">▦</span>
                                <span class="ss-btn-lbl">テーブル</span>
                            </span>
                            <span class="button ss-btn-large" data-action="toggle-table-total" title="テーブル末尾の集計行を表示/非表示">
                                <span class="ss-btn-ico-lg">Σ</span>
                                <span class="ss-btn-lbl">集計行</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">テーブル</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="ss-ribbon-col">
                                <div class="ss-ribbon-row">
                                    <span class="button" data-action="insert-chart-bar">📊 縦棒</span>
                                    <span class="button" data-action="insert-chart-stacked">🧱 積み上げ</span>
                                    <span class="button" data-action="insert-chart-line">📈 折れ線</span>
                                </div>
                                <div class="ss-ribbon-row">
                                    <span class="button" data-action="insert-chart-pie">🥧 円グラフ</span>
                                    <span class="button" data-action="insert-chart-scatter">⚬ 散布図</span>
                                </div>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">グラフ</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="insert-textbox">
                                <span class="ss-btn-ico-lg">📝</span>
                                <span class="ss-btn-lbl">テキストボックス</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">テキスト</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="insert-hyperlink" title="ハイパーリンクの挿入・編集 (Ctrl+K)">
                                <span class="ss-btn-ico-lg">🔗</span>
                                <span class="ss-btn-lbl">リンク</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">リンク</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="insert-comment" title="コメントの挿入・編集">
                                <span class="ss-btn-ico-lg">💬</span>
                                <span class="ss-btn-lbl">コメント</span>
                            </span>
                            <span class="button ss-btn-large" data-action="insert-note" title="メモの挿入・編集">
                                <span class="ss-btn-ico-lg">🗒</span>
                                <span class="ss-btn-lbl">メモ</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">コメント</div>
                    </div>
                </div>

                <!-- ==================== [ページレイアウト] タブ ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="pagelayout">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large">
                                    <span class="ss-btn-ico-lg">📄</span>
                                    <span class="ss-btn-lbl">サイズ ▼</span>
                                </span>
                                <ul class="pulldown_menu" style="min-width:130px;">
                                    <li class="button" data-pagesize="A4">A4 (標準)</li>
                                    <li class="button" data-pagesize="A3">A3</li>
                                    <li class="button" data-pagesize="B5">B5</li>
                                    <li class="button" data-pagesize="B4">B4</li>
                                </ul>
                            </div>
                            <span class="button ss-print-orient-btn ss-btn-large" data-action="toggle-print-orientation" title="印刷の向き（縦 / 横）">
                                <span class="ss-btn-ico-lg">🧭</span>
                                <span class="ss-btn-lbl">向き: 縦</span>
                            </span>
                            <div class="ss-ribbon-col">
                                <span class="button ss-print-fit-btn selected" data-action="toggle-print-fit" title="すべての列を用紙幅に収めて印刷">幅を1ページに収める</span>
                                <span class="button ss-print-grid-btn" data-action="toggle-print-grid" title="セルの薄い枠線も印刷に含める">枠線を印刷</span>
                            </div>
                            <span class="button ss-btn-large" data-action="print">
                                <span class="ss-btn-ico-lg">🖨</span>
                                <span class="ss-btn-lbl">印刷実行</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">ページ設定</div>
                    </div>
                </div>

                <!-- ==================== [数式] タブ（Excel準拠2段配置） ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="formulas">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="auto-sum" title="オートSUM">
                                <span class="ss-btn-ico-lg">Σ</span>
                                <span class="ss-btn-lbl">オート<br>SUM</span>
                            </span>

                            <div class="ss-ribbon-col">
                                <div class="ss-ribbon-row">
                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">最近使用 ▼</span>
                                        <ul class="pulldown_menu ss-recent-fn-menu" style="min-width:210px;"></ul>
                                    </div>

                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">財務 ▼</span>
                                        <ul class="pulldown_menu" style="min-width:220px;">
                                            <li class="button" data-fn-tpl="=PMT(, , )">PMT - 定期支払額</li>
                                            <li class="button" data-fn-tpl="=FV(, , )">FV - 将来価値</li>
                                            <li class="button" data-fn-tpl="=PV(, , )">PV - 現在価値</li>
                                            <li class="button" data-fn-tpl="=NPV(, )">NPV - 正味現在価値</li>
                                            <li class="button" data-fn-tpl="=IRR()">IRR - 内部利益率</li>
                                        </ul>
                                    </div>

                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">論理 ▼</span>
                                        <ul class="pulldown_menu" style="min-width:220px;">
                                            <li class="button" data-fn-tpl="=IF(, , )">IF - 条件分岐</li>
                                            <li class="button" data-fn-tpl="=IFS(, , , )">IFS - 複数条件分岐</li>
                                            <li class="button" data-fn-tpl="=SWITCH(, , , )">SWITCH - 値一致分岐</li>
                                            <li class="button" data-fn-tpl="=IFERROR(, 0)">IFERROR - エラー時置換</li>
                                            <li class="button" data-fn-tpl="=AND(, )">AND - 論理積</li>
                                            <li class="button" data-fn-tpl="=OR(, )">OR - 論理和</li>
                                            <li class="button" data-fn-tpl="=XOR(, )">XOR - 排他的論理和</li>
                                            <li class="button" data-fn-tpl="=NOT()">NOT - 論理否定</li>
                                        </ul>
                                    </div>

                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">文字列操作 ▼</span>
                                        <ul class="pulldown_menu" style="min-width:230px;">
                                            <li class="button" data-fn-tpl="=TEXTJOIN(&quot;,&quot;, TRUE, )">TEXTJOIN - 区切り文字結合</li>
                                            <li class="button" data-fn-tpl="=TEXTSPLIT(, &quot;,&quot;)">TEXTSPLIT - 文字列分割</li>
                                            <li class="button" data-fn-tpl="=CONCAT(, )">CONCAT - 文字列結合</li>
                                            <li class="button" data-fn-tpl="=SUBSTITUTE(, , )">SUBSTITUTE - 文字列置換</li>
                                            <li class="button" data-fn-tpl="=TRIM()">TRIM - 余分な空白削除</li>
                                            <li class="button" data-fn-tpl="=CLEAN()">CLEAN - 制御文字削除</li>
                                            <li class="button" data-fn-tpl="=LEFT(, 1)">LEFT - 左端から抽出</li>
                                            <li class="button" data-fn-tpl="=RIGHT(, 1)">RIGHT - 右端から抽出</li>
                                            <li class="button" data-fn-tpl="=MID(, 1, 1)">MID - 指定位置から抽出</li>
                                            <li class="button" data-fn-tpl="=LEN()">LEN - 文字数</li>
                                            <li class="button" data-fn-tpl="=UPPER()">UPPER - 大文字変換</li>
                                            <li class="button" data-fn-tpl="=LOWER()">LOWER - 小文字変換</li>
                                        </ul>
                                    </div>

                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">日付と時刻 ▼</span>
                                        <ul class="pulldown_menu" style="min-width:230px;">
                                            <li class="button" data-fn-tpl="=TODAY()">TODAY - 今日の日付</li>
                                            <li class="button" data-fn-tpl="=NOW()">NOW - 現在日時</li>
                                            <li class="button" data-fn-tpl="=DATE(2026, 11, 17)">DATE - 日付作成</li>
                                            <li class="button" data-fn-tpl="=EDATE(, 1)">EDATE - 指定月数前後</li>
                                            <li class="button" data-fn-tpl="=EOMONTH(, 0)">EOMONTH - 月末日</li>
                                            <li class="button" data-fn-tpl="=NETWORKDAYS(, )">NETWORKDAYS - 稼働日数</li>
                                            <li class="button" data-fn-tpl="=WORKDAY(, 1)">WORKDAY - 稼働日後日付</li>
                                            <li class="button" data-fn-tpl="=DATEDIF(, , &quot;D&quot;)">DATEDIF - 期間計算</li>
                                            <li class="button" data-fn-tpl="=YEAR()">YEAR - 年</li>
                                            <li class="button" data-fn-tpl="=MONTH()">MONTH - 月</li>
                                            <li class="button" data-fn-tpl="=DAY()">DAY - 日</li>
                                        </ul>
                                    </div>
                                </div>

                                <div class="ss-ribbon-row">
                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">検索と参照 ▼</span>
                                        <ul class="pulldown_menu" style="min-width:240px;">
                                            <li class="button" data-fn-tpl="=XLOOKUP(, , )">XLOOKUP - モダン範囲検索</li>
                                            <li class="button" data-fn-tpl="=XMATCH(, )">XMATCH - モダン位置検索</li>
                                            <li class="button" data-fn-tpl="=VLOOKUP(, , 2, FALSE)">VLOOKUP - 垂直検索</li>
                                            <li class="button" data-fn-tpl="=HLOOKUP(, , 2, FALSE)">HLOOKUP - 水平検索</li>
                                            <li class="button" data-fn-tpl="=INDEX(, 1, 1)">INDEX - 行列位置指定取得</li>
                                            <li class="button" data-fn-tpl="=MATCH(, , 0)">MATCH - 相対位置検索</li>
                                            <li class="button" data-fn-tpl="=FILTER(, )">FILTER - 条件抽出（動的配列）</li>
                                            <li class="button" data-fn-tpl="=UNIQUE()">UNIQUE - 重複除外（動的配列）</li>
                                            <li class="button" data-fn-tpl="=CHOOSECOLS(, 1)">CHOOSECOLS - 指定列抽出</li>
                                            <li class="button" data-fn-tpl="=CHOOSEROWS(, 1)">CHOOSEROWS - 指定行抽出</li>
                                        </ul>
                                    </div>

                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">統計 ▼</span>
                                        <ul class="pulldown_menu" style="min-width:230px;">
                                            <li class="button" data-fn-tpl="=AVERAGE()">AVERAGE - 平均</li>
                                            <li class="button" data-fn-tpl="=AVERAGEIF(, )">AVERAGEIF - 条件付き平均</li>
                                            <li class="button" data-fn-tpl="=AVERAGEIFS(, , )">AVERAGEIFS - 複数条件平均</li>
                                            <li class="button" data-fn-tpl="=COUNT()">COUNT - 数値の個数</li>
                                            <li class="button" data-fn-tpl="=COUNTA()">COUNTA - 空白以外の個数</li>
                                            <li class="button" data-fn-tpl="=COUNTIF(, )">COUNTIF - 条件付き件数</li>
                                            <li class="button" data-fn-tpl="=COUNTIFS(, )">COUNTIFS - 複数条件件数</li>
                                            <li class="button" data-fn-tpl="=MAX()">MAX - 最大値</li>
                                            <li class="button" data-fn-tpl="=MIN()">MIN - 最小値</li>
                                            <li class="button" data-fn-tpl="=MEDIAN()">MEDIAN - 中央値</li>
                                            <li class="button" data-fn-tpl="=STDEV()">STDEV - 標準偏差</li>
                                        </ul>
                                    </div>

                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">数学・三角 ▼</span>
                                        <ul class="pulldown_menu" style="min-width:240px;">
                                            <li class="button" data-fn-tpl="=SUM()">SUM - 合計</li>
                                            <li class="button" data-fn-tpl="=SUMIF(, )">SUMIF - 条件付き合計</li>
                                            <li class="button" data-fn-tpl="=SUMIFS(, , )">SUMIFS - 複数条件合計</li>
                                            <li class="button" data-fn-tpl="=SUBTOTAL(9, )">SUBTOTAL - 集計（9=SUM）</li>
                                            <li class="button" data-fn-tpl="=AGGREGATE(9, 6, )">AGGREGATE - エラー無視集計</li>
                                            <li class="button" data-fn-tpl="=ROUND(, 0)">ROUND - 四捨五入</li>
                                            <li class="button" data-fn-tpl="=ROUNDUP(, 0)">ROUNDUP - 切り上げ</li>
                                            <li class="button" data-fn-tpl="=ROUNDDOWN(, 0)">ROUNDDOWN - 切り捨て</li>
                                            <li class="button" data-fn-tpl="=ABS()">ABS - 絶対値</li>
                                            <li class="button" data-fn-tpl="=POWER(, 2)">POWER - べき乗</li>
                                            <li class="button" data-fn-tpl="=SQRT()">SQRT - 平方根</li>
                                            <li class="button" data-fn-tpl="=MOD(, )">MOD - 剰余</li>
                                            <li class="button" data-fn-tpl="=SEQUENCE(5, 1, 1, 1)">SEQUENCE - 連続数値配列</li>
                                            <li class="button" data-fn-tpl="=RANDARRAY(3, 3, 1, 100, TRUE)">RANDARRAY - 乱数配列</li>
                                        </ul>
                                    </div>

                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">情報関数 ▼</span>
                                        <ul class="pulldown_menu" style="min-width:210px;">
                                            <li class="button" data-fn-tpl="=ISBLANK()">ISBLANK - 空白判定</li>
                                            <li class="button" data-fn-tpl="=ISNUMBER()">ISNUMBER - 数値判定</li>
                                            <li class="button" data-fn-tpl="=ISTEXT()">ISTEXT - 文字列判定</li>
                                            <li class="button" data-fn-tpl="=ISERROR()">ISERROR - エラー判定</li>
                                            <li class="button" data-fn-tpl="=ISNA()">ISNA - #N/A判定</li>
                                            <li class="button" data-fn-tpl="=TYPE()">TYPE - データ型番号</li>
                                            <li class="button" data-fn-tpl="=N()">N - 数値変換</li>
                                            <li class="button" data-fn-tpl="=NA()">NA - #N/A生成</li>
                                        </ul>
                                    </div>

                                    <div class="pulldown_menu_parent">
                                        <span class="button pulldown_btn">配列・LAMBDA ▼</span>
                                        <ul class="pulldown_menu" style="min-width:240px;">
                                            <li class="button" data-fn-tpl="=SORT(, 1, 1)">SORT - 範囲並べ替え</li>
                                            <li class="button" data-fn-tpl="=SORTBY(, , 1)">SORTBY - 別列基準並べ替え</li>
                                            <li class="button" data-fn-tpl="=TAKE(, 3)">TAKE - 先頭/末尾の行列取得</li>
                                            <li class="button" data-fn-tpl="=DROP(, 1)">DROP - 先頭/末尾の行列除外</li>
                                            <li class="button" data-fn-tpl="=EXPAND(, 5, 5, &quot;&quot;)">EXPAND - 配列サイズ拡張</li>
                                            <li class="button" data-fn-tpl="=LET(x, 10, x * 2)">LET - 変数定義計算</li>
                                            <li class="button" data-fn-tpl="=LAMBDA(x, x + 1)(5)">LAMBDA - カスタム関数</li>
                                            <li class="button" data-fn-tpl="=MAP(, LAMBDA(x, x * 2))">MAP - 各要素変換</li>
                                            <li class="button" data-fn-tpl="=REDUCE(0, , LAMBDA(a, b, a + b))">REDUCE - 累積畳み込み</li>
                                            <li class="button" data-fn-tpl="=SCAN(0, , LAMBDA(a, b, a + b))">SCAN - 累積中間結果配列</li>
                                            <li class="button" data-fn-tpl="=BYROW(, LAMBDA(r, SUM(r)))">BYROW - 行単位計算</li>
                                            <li class="button" data-fn-tpl="=BYCOL(, LAMBDA(c, SUM(c)))">BYCOL - 列単位計算</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">関数ライブラリ</div>
                    </div>

                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="define-name" title="名前の定義・管理">
                                <span class="ss-btn-ico-lg">🏷</span>
                                <span class="ss-btn-lbl">名前の<br>管理</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">定義された名前</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="recalc-all" title="ブック全体の数式を再計算">
                                <span class="ss-btn-ico-lg">🔄</span>
                                <span class="ss-btn-lbl">再計算</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">計算方法</div>
                    </div>
                </div>

               <!-- ==================== [データ] タブ ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="data">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="ss-ribbon-col">
                                <span class="button" data-sort="asc">A↓Z 昇順</span>
                                <span class="button" data-sort="desc">Z↓A 降順</span>
                            </div>
                            <span class="button ss-toggle-filter-btn ss-btn-large" data-action="toggle-autofilter" title="オートフィルターの切り替え (Ctrl+Shift+L)">
                                <span class="ss-btn-ico-lg">🔽</span>
                                <span class="ss-btn-lbl">フィルター</span>
                            </span>
                            <div class="ss-ribbon-col">
                                <span class="button" data-action="clear-autofilter" title="フィルター条件をすべてクリア">クリア</span>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">並べ替えとフィルター</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="text-to-columns" title="1列のテキストを区切り文字で複数列に分割">
                                <span class="ss-btn-ico-lg">✂</span>
                                <span class="ss-btn-lbl">区切り位置</span>
                            </span>
                            <div class="ss-ribbon-col">
                                <span class="button" data-action="remove-duplicates" title="選択範囲から重複する行を削除">🧹 重複の削除</span>
                                <span class="button" data-action="data-validation" title="セルにドロップダウンリストや入力制限を設定">📋 データの入力規則</span>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">データツール</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="import-local">
                                <span class="ss-btn-ico-lg">📥</span>
                                <span class="ss-btn-lbl">CSV/NXS 読込</span>
                            </span>
                            <div class="ss-ribbon-col">
                                <span class="button" data-action="export-nxs">📤 NXS 出力</span>
                                <span class="button" data-action="export-csv-local">📤 CSV 出力</span>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">データの取得と変換</div>
                    </div>
                </div>

                <!-- ==================== [表示] タブ ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="view">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn ss-btn-large">
                                    <span class="ss-btn-ico-lg">❄</span>
                                    <span class="ss-btn-lbl">枠の固定 ▼</span>
                                </span>
                                <ul class="pulldown_menu" style="min-width:210px;">
                                    <li class="button" data-freeze="active">ウィンドウ枠の固定（選択セル基準）</li>
                                    <li class="button" data-freeze="top-row">先頭行の固定</li>
                                    <li class="button" data-freeze="first-col">先頭列の固定</li>
                                    <li class="ss-menu-sep"></li>
                                    <li class="button" data-freeze="unfreeze">ウィンドウ枠固定の解除</li>
                                </ul>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">ウィンドウ</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large" data-action="zoom-100">
                                <span class="ss-btn-ico-lg">🔎</span>
                                <span class="ss-btn-lbl">100%</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">ズーム</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="ss-ribbon-col ss-ribbon-col-stack">
                                <span class="button ss-view-gridlines-btn selected" data-action="toggle-gridlines" title="セルの枠線（目盛線）の表示/非表示">☑ 枠線</span>
                                <span class="button ss-view-headers-btn selected" data-action="toggle-headers" title="行列見出し（A,B / 1,2）の表示/非表示">☑ 見出し</span>
                                <span class="button ss-view-formulabar-btn selected" data-action="toggle-formulabar" title="数式バーの表示/非表示">☑ 数式バー</span>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">表示</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-btn-large ss-protect-sheet-btn" data-action="toggle-sheet-protect" title="現在のシートを保護/解除（ロックセルの編集を防止）">
                                <span class="ss-btn-ico-lg">🔒</span>
                                <span class="ss-btn-lbl">シート<br>保護</span>
                            </span>
                        </div>
                        <div class="ss-ribbon-group-title">保護</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 数式バー -->
        <div class="ss-formula-bar-container">
            <input type="text" class="border ss-selected-cells-display" value="A1" autocomplete="off" title="名前ボックス（セル番地や範囲を入力してEnterで移動）" />
            <span class="button mark_btn cross" data-action="revert-formula" title="キャンセル"></span>
            <span class="button mark_btn checkmark" data-action="commit-formula" title="確定"></span>
            <span class="button" data-action="focus-formulas-tab" style="height:24px; padding:0 8px; font-style:italic;" title="数式タブを開く">fx</span>
            <textarea class="ss-formula-bar border" rows="1" spellcheck="false" autocomplete="off" placeholder="値または数式 (=XLOOKUP(...) / =FILTER(...) など) を入力... (Alt+Enterで改行)"></textarea>
        </div>

        <!-- スプレッドシート本体 -->
        <div class="ss-spreadsheet-container">
            <div class="ss-spreadsheet-content">
                <table class="ss-table">
                    <colgroup>
                        <col style="width: 54px;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th class="ss-corner button" title="全セル選択">全選択</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>

       <!-- Excel準拠：シートタブ一覧 ＆ ズームバー 同一エリア配置 -->
        <div class="ss-bottom-bar" style="justify-content:space-between; padding-right:8px;">
            <div class="ss-tabs-region" style="flex:1 1 auto; max-width:none;">
                <div class="ss-tab-nav-btns">
                    <span class="button ss-tab-nav-btn" data-tab-scroll="left" title="前のシートタブへスクロール">◀</span>
                    <span class="button ss-tab-nav-btn" data-tab-scroll="right" title="次のシートタブへスクロール">▶</span>
                </div>
                <div class="ss-sheet-tabs-scroll">
                    <div class="ss-sheet-tabs-list"></div>
                </div>
                <span class="button ss-sheet-add-btn" title="新しいシートを追加">＋</span>
            </div>
            <div style="display:inline-flex; align-items:center; gap:6px; flex-shrink:0;">
                <label style="font-size:11px;">拡大率:</label>
                <input type="range" class="ss-zoom-slider" min="20" max="200" value="100" step="5">
                <span class="ss-zoom-display" style="min-width:38px; font-weight:bold;">100%</span>
            </div>
        </div>
    </div>
`;