# Infinite Canvas 寮€鍙戣鍒?
> 鐩爣锛氬仛涓€涓?*鍙暱鏈熺淮鎶ゃ€佸彲灞曠ず銆佸彲寮€婧?*鐨勬棤闄愮敾甯冪紪杈戝櫒銆?> 褰撳墠鐗堟湰锛歚v0.2.0-dev`锛堢紪杈戝櫒鍩虹锛屽熀浜?`v0.1.0` / commit `2c92671`锛?> 浠撳簱锛?https://github.com/ricardo0510/infinite-canvas>

---

## 1. 椤圭洰瀹氫綅

**涓€鍙ヨ瘽**锛歀ocal-first 鐨勬棤闄愮敾甯冪紪杈戝櫒锛岄潰鍚戠瑪璁般€佹祦绋嬪浘銆佺伒鎰熸暣鐞嗗拰 AI 宸ヤ綔娴佺殑鍓嶇搴曞骇銆?
**鏍稿績鍘熷垯**

- **鏈湴浼樺厛**锛氶粯璁や笉涓婁紶鏁版嵁锛宭ocalStorage / IndexedDB 鍗冲彲宸ヤ綔銆?- **灏忔牳蹇冦€佸彲鎵╁睍**锛氱敾甯冨紩鎿庛€佺姸鎬併€佸瓨鍌ㄣ€佽妭鐐圭被鍨嬪郊姝よВ鑰︼紝鏂逛究鍔犳柊鑺傜偣鍜屾彃浠躲€?- **鍙睍绀?*锛氭瘡涓樁娈甸兘鏈夊彲杩愯 Demo 鍜屾埅鍥撅紝鑳界洿鎺ユ斁杩涚畝鍘?浣滃搧闆嗐€?- **涓嶈繃搴﹁璁?*锛氬厛瑙ｅ喅鐪熷疄缂栬緫浣撻獙锛屽啀鑰冭檻鍗忎綔鍜?AI銆?
**鐩爣鐢ㄦ埛**

1. 闇€瑕佸揩閫熺敾娴佺▼鍥?鎬濈淮瀵煎浘鐨勪釜浜虹敤鎴枫€?2. 鎯充簩娆″紑鍙戠敾甯冧骇鍝佺殑寮€鍙戣€呫€?3. 闈㈣瘯瀹?寮€婧愮敤鎴凤細鐪嬩唬鐮佺粨鏋勩€佷氦浜掔粏鑺傚拰宸ョ▼璐ㄩ噺銆?
**闈炵洰鏍囷紙v1.0 鍓嶄笉鍋氾級**

- 涓嶅仛瀹屾暣 Miro/Figma 鏇夸唬鍝併€?- 涓嶅仛璐﹀彿浣撶郴銆佷簯绔悓姝ャ€佽璐广€?- 涓嶅湪鏍稿績绋冲畾鍓嶅仛澶氫汉鍗忎綔鍜?AI 鑷姩鎵ц銆?- 涓嶈拷姹傜Щ鍔ㄧ瀹屾暣缂栬緫浣撻獙锛屽厛淇濊瘉妗岄潰绔€?
---

## 2. 褰撳墠鍩虹嚎锛坴0.1.0锛?
**鎶€鏈爤**

| 灞?| 閫夊瀷 |
| --- | --- |
| 妗嗘灦 | React 19 + TypeScript |
| 鏋勫缓 | Vite 8 |
| 鐢诲竷 | @xyflow/react 12 |
| 鐘舵€?| Zustand 5 |
| 鏍峰紡 | 鍘熺敓 CSS + CSS Variables |
| 璐ㄩ噺 | oxlint + `tsc -b` |

**宸插疄鐜?*

- 鏃犻檺骞崇Щ/缂╂斁銆丮iniMap銆丆ontrols銆丗it View
- 鑷畾涔?Note 鑺傜偣锛氭爣棰?姝ｆ枃鐩存帴缂栬緫銆? 绉嶅己璋冭壊
- 鎷栨嫿銆佽繛绾裤€佸閫夈€佹閫?- 鎾ら攢/閲嶅仛锛?0 姝ワ級銆佸鍒?绮樿创銆丆trl+D 澶嶅埗
- localStorage 鑷姩淇濆瓨锛?00ms debounce锛?- JSON 瀵煎叆/瀵煎嚭
- 蹇嵎閿細鎾ら攢/閲嶅仛/澶嶅埗/绮樿创/鍒犻櫎/淇濆瓨
- 鐘舵€佹爮锛氳妭鐐规暟銆佽繛绾挎暟銆佺缉鏀炬瘮渚?
**浠ｇ爜缁撴瀯**

```
src/
  components/
    FlowCanvas.tsx        # React Flow 瀹瑰櫒銆佸彸閿?杈呭姪绾?娴眰
    Toolbar.tsx           # 鏂板缓鑺傜偣銆佹挙閿€銆佸竷灞€銆佸惛闄勩€佸鍏ュ鍑?    SelectionToolbar.tsx  # 瀵归綈/鍒嗗竷/鎴愮粍
    ContextMenu.tsx       # 鍙抽敭鑿滃崟
    KeyboardHelp.tsx      # 蹇嵎閿潰鏉匡紙?锛?    EmptyState.tsx        # 绌虹敾甯冨紩瀵?    StatusBar.tsx         # 鑺傜偣/杩炵嚎/缂╂斁鐘舵€?    nodes/                # Note / Text / Image / Group
  hooks/
    useAutoSave.ts        # 璁㈤槄 store锛岄槻鎶栧啓 localStorage
    useCanvasShortcuts.ts
  lib/
    storage.ts            # schema v2銆佹牎楠屻€佽縼绉汇€佸鍏ュ鍑?    geometry.ts           # 灏哄銆佺粷瀵瑰潗鏍囥€佸悗浠ｈ妭鐐?    guides.ts             # 瀵归綈杈呭姪绾胯绠?    layout.ts             # Dagre 鑷姩甯冨眬锛堟寜闇€鍔犺浇锛?  store/
    canvasStore.ts        # nodes/edges/history/clipboard
    uiStore.ts            # 鍚搁檮寮€鍏炽€佸府鍔╅潰鏉?  types.ts
  App.tsx / main.tsx / index.css
```

**褰撳墠鏋勫缓鎸囨爣**

- 棣栧睆 JS锛?67 KB锛坓zip 145 KB锛夛紱Dagre 鑷姩甯冨眬鍗曠嫭鍒嗗寘 47 KB锛坓zip 16 KB锛?- CSS锛?6.3 KB锛坓zip 6.8 KB锛?- 鎬ц兘锛坔eadless Chrome锛?440脳900锛夛細500 鑺傜偣 setup 323ms / 鎷栧姩 60.1 FPS锛?000 鑺傜偣 setup 380ms / 鎷栧姩 60.0 FPS锛涘彲瑙?DOM 绾?15 涓妭鐐?- 棣栨鍔犺浇鏈仛璺敱/浠ｇ爜鍒嗗壊锛岄噸渚濊禆锛圖agre锛夊凡鎸夐渶鍔犺浇

**宸茬煡闄愬埗**

- 娌℃湁杈规爣绛?杈规牱寮忕紪杈戯紝娌℃湁褰㈢姸鑺傜偣銆?- 鍘嗗彶璁板綍鍩轰簬蹇収锛岃妭鐐瑰緢澶氭椂鍐呭瓨浼氬闀裤€?- 鍙敮鎸?localStorage锛涘浘鐗囦互 data URL 瀛樺偍锛屽ぇ鍥句細鍗犻厤棰濄€?- 娌℃湁 E2E銆丩icense銆?- 鍙闂€у拰绉诲姩绔彧鍋氫簡鍩虹澶勭悊銆?
---

## 3. 鏋舵瀯涓庢墿灞曠偣

### 3.1 鏁版嵁娴?
```
鐢ㄦ埛鎿嶄綔
  鈫?React Flow 浜嬩欢锛坥nNodesChange / onConnect / onNodeDragStart锛?  鈫?Zustand store锛坅pplyNodeChanges / commit / history锛?  鈫?鍙楁帶 nodes / edges
  鈫?React Flow 閲嶆覆鏌?
store 鍙樺寲
  鈫?useAutoSave 璁㈤槄
  鈫?debounce 400ms
  鈫?localStorage
```

### 3.2 鐘舵€佽亴璐?
| 鐘舵€?| 褰掑睘 | 璇存槑 |
| --- | --- | --- |
| `nodes` / `edges` | canvasStore | 鍞竴鏁版嵁婧愶紝React Flow 鍙楁帶 |
| `past` / `future` | canvasStore | 蹇収鍘嗗彶锛屾渶澶?50 姝?|
| `clipboard` | canvasStore | 鍐呴儴澶嶅埗/绮樿创锛屼笉渚濊禆绯荤粺鍓创鏉?|
| 瑙嗗彛 | React Flow | 涓嶆斁杩?store锛岄伩鍏嶉珮棰戦噸娓叉煋 |
| 閫変腑鎬?| node/edge 鐨?`selected` | 鐢?React Flow 缁存姢 |
| 鎸佷箙鍖?| storage.ts | 鐗堟湰鍖?JSON锛屽悗缁彲鎹?IndexedDB |

### 3.3 鎵╁睍鐐?
- **鏂拌妭鐐圭被鍨?*锛氭柊澧?`components/nodes/XxxNode.tsx`锛屾敞鍐屽埌 `nodeTypes`锛屽湪 `types.ts` 澧炲姞 data 绫诲瀷銆?- **鏂拌竟绫诲瀷**锛歚edgeTypes` + `defaultEdgeOptions`銆?- **鏂板伐鍏?*锛歍oolbar 鍔犳寜閽紝store 鍔?action銆?- **瀛樺偍閫傞厤鍣?*锛歚lib/storage.ts` 鎶芥垚 `StorageAdapter`锛屾敮鎸?localStorage / IndexedDB / 鏂囦欢銆?- **鍛戒护绯荤粺**锛氬悗缁妸 Toolbar/蹇嵎閿粺涓€鎴?command registry锛屾柟渚垮仛鍛戒护闈㈡澘鍜屾挙閿€鍒嗙粍銆?
---

## 4. 璺嚎鍥?
### v0.2 鈥?缂栬緫鍣ㄥ熀纭€锛?鈥? 鍛級

**鐩爣**锛氫粠鈥滆兘鐢烩€濆埌鈥滃ソ鐢ㄢ€濄€?
- [x] 鏂板鑺傜偣绫诲瀷锛歍ext銆両mage銆丟roup
- [x] 鍙抽敭鑿滃崟锛氭柊寤鸿妭鐐广€佸鍒躲€佸垹闄ゃ€佺疆椤?缃簳
- [x] 閫変腑宸ュ叿鏍忥細鎵归噺鍒犻櫎銆佸榻愩€佸垎甯冦€佹垚缁?- [x] 缃戞牸鍚搁檮锛?px锛? 鏅鸿兘瀵归綈鍚搁檮锛?px/缂╂斁锛屽閫夊寘鍥寸洅锛?- [x] 瑙嗗彛鎸佷箙鍖栥€佺缉鏀鹃璁俱€佸皬鍦板浘寮€鍏?- [x] 杩炵嚎鏍￠獙锛堣嚜杩?閲嶅锛夈€佹偓鍋滃垹闄ゃ€佹嫋鍒扮┖鐧藉垱寤鸿妭鐐瑰苟鑷姩杩炴帴
- [x] 鍒嗙粍鎷栧叆/鎷栧嚭锛屽垎缁勮嚜鍔ㄦ墿灞曞绾虫柊鑺傜偣
- [x] 鑷姩甯冨眬锛圖agre锛夛細涓€閿暣鐞嗭紙鎸夐渶鍔犺浇锛?- [x] 杈规爣绛?杈规牱寮忥紙棰滆壊銆佽櫄绾裤€佺澶达級
- [x] 鑺傜偣灏哄鎸佷箙鍖栦笌鏈€灏忓昂瀵哥害鏉?- [x] 蹇嵎閿潰鏉匡紙`?` 鎵撳紑锛?- [x] 绌虹敾甯冨紩瀵?+ 娴佺▼鍥?鎬濈淮瀵煎浘/鐪嬫澘/浼氳妯℃澘
- [x] 鍛戒护闈㈡澘锛坄/`锛?
**楠屾敹**锛氭柊寤?缂栬緫/杩炵嚎/鍒嗙粍/鏁寸悊 5 鏉′富娴佺▼鏃犻樆濉烇紱鍒锋柊鍚庡竷灞€涓嶄涪锛沗npm run build` + `lint` 閫氳繃銆?
### v0.3 鈥?鏁版嵁涓庣ǔ瀹氭€э紙1鈥? 鍛級

**鐩爣**锛氭暟鎹笉涓紝鐗堟湰鍙崌绾э紝鎬ц兘鍙噺鍖栥€?
- [x] Schema 鐗堟湰鍙?+ 杩佺Щ鍑芥暟锛坴1 鈫?v2锛?- [ ] IndexedDB 瀛樺偍閫傞厤鍣紙澶у浘/鍥剧墖鑺傜偣锛?- [ ] 鍘嗗彶璁板綍鏀逛负澧為噺 patch 鎴栧帇缂╁揩鐓э紙鎺у埗鍐呭瓨锛?- [x] 鍥剧墖鑺傜偣锛氫笂浼?鎷栧叆/绮樿创 + 鑷姩灏哄锛堜粛浠?data URL 瀛樺偍锛?- [x] 瀵煎叆瀵煎嚭鍏煎鏃х増鏈紱瀵煎叆澶辫触缁欏嚭鍙 toast
- [x] Error Boundary + 鍏ㄥ眬閿欒鎻愮ず
- [x] 500 / 1000 鑺傜偣鎬ц兘鍩哄噯涓庝紭鍖栵紙鑺傜偣 memo銆?80 鑺傜偣浠呮覆鏌撳彲瑙嗗厓绱狅級
- [x] 鍗曞厓娴嬭瘯锛歴tore銆乭istory銆乻torage銆佽縼绉?- [ ] Playwright E2E锛氭柊寤恒€佽繛绾裤€佹挙閿€銆佸鍏ュ鍑?
**楠屾敹**锛?000 鑺傜偣鎷栨嫿 鈮?45 FPS锛堜腑绔満锛夛紱鍒锋柊/閲嶅惎涓嶄涪鏁版嵁锛涙祴璇曡鐩栨牳蹇冭矾寰勩€?
### v0.4 鈥?寮€婧愬彂甯冿紙1 鍛級

**鐩爣**锛氬埆浜鸿兘鐪嬫噦銆佽兘璺戙€佽兘璐＄尞銆?
- [ ] README锛欴emo GIF銆佸姛鑳姐€佹灦鏋勩€佸揩閫熷紑濮嬨€佽矾绾垮浘閾炬帴
- [ ] GitHub Pages 鍦ㄧ嚎 Demo锛圴ite `base` 閰嶇疆锛?- [ ] MIT License
- [ ] CONTRIBUTING + Issue/PR 妯℃澘
- [ ] GitHub Actions锛歵ypecheck銆乴int銆乽nit銆乥uild銆丳laywright
- [ ] CHANGELOG + `v0.1.0` / `v0.2.0` tag
- [ ] 3鈥? 寮犻珮璐ㄩ噺鎴浘/鐭棰?- [ ] 浠撳簱 description/topics

**楠屾敹**锛氭柊鐢ㄦ埛 3 鍒嗛挓鍐呮湰鍦拌窇璧锋潵锛汣I 鍏ㄧ豢锛汥emo 鍙洿鎺ヨ闂€?
### v0.5 鈥?鍙€夋柟鍚戯紙鎸夋眰鑱岀洰鏍囬€変竴涓級

**A. AI 鎸囦护鏍忥紙2 鍛紝鎺ㄨ崘锛?*

- 鑷劧璇█ 鈫?缁撴瀯鍖栧姩浣滐紙鏂板鑺傜偣/杩炵嚎/鏀归鑹?鏁寸悊锛?- 鍔ㄤ綔纭鍗＄墖 + 鎾ら攢
- Mock 妯″瀷 + 鐪熷疄 LLM 閫傞厤鍣?- 宸ュ叿 schema + eval 鐢ㄤ緥锛?0 鏉★級
- 浠峰€硷細鍜?AI Agent 绠€鍘嗕富绾垮己鐩稿叧

**B. 澶氫汉鍗忎綔锛?鈥? 鍛級**

- Yjs + WebSocket/WebRTC
- 鍏夋爣/鍦ㄧ嚎鐘舵€?鎴块棿
- 鍐茬獊鍚堝苟涓庣绾块噸杩?- 浠峰€硷細鎶€鏈繁搴﹂珮锛屼絾璋冭瘯鎴愭湰楂?
**C. 鎻掍欢绯荤粺锛? 鍛級**

- 鑺傜偣/鍛戒护/瀛樺偍鎻掍欢鎺ュ彛
- 绀轰緥鎻掍欢锛氫究绛俱€佸浘鐗囥€丮arkdown
- 浠峰€硷細鏋舵瀯鑳藉姏灞曠ず

### v1.0 鈥?绋冲畾鐗堬紙鎸佺画锛?
- [ ] Schema 绋冲畾 + 杩佺Щ鏂囨。
- [ ] 鎻掍欢 API 鏂囨。
- [ ] 5000 鑺傜偣鎬ц兘鐩爣
- [ ] 瀹屾暣閿洏瀵艰埅/鍙闂€?- [ ] i18n锛堜腑/鑻憋級
- [ ] 涓婚锛堟繁/娴?璺熼殢绯荤粺锛?- [ ] 鏂囨。绔欙紙VitePress/Astro锛?- [ ] 绀惧尯 issue/PR 鍝嶅簲鏈哄埗

---

## 5. 鎶€鏈笓椤?
### 5.1 鎬ц兘

| 椋庨櫓 | 鎺柦 |
| --- | --- |
| 鑺傜偣澶氭椂閲嶆覆鏌?| 宸插仛锛氳妭鐐圭粍浠?`memo`锛坄nodePropsEqual` 蹇界暐浣嶇疆/灏哄锛?|
| 杈?鑺傜偣 DOM 杩囧 | 宸插仛锛?80 鑺傜偣寮€鍚?`onlyRenderVisibleElements`锛屽皬鍦板浘 >60 鑷姩鏀惰捣 |
| 鎷栨嫿鎺夊抚 | 鎷栨嫿鏈熼棿鍏抽棴鍔ㄧ敾/闃村奖锛沗nodeDragThreshold` |
| 鍘嗗彶蹇収鍐呭瓨 | 闄愬埗 50 姝ワ紱鍚庣画鏀瑰閲?patch |
| localStorage 瀹归噺 | 鍥剧墖璧?IndexedDB锛屼笉濉?base64 |

**鍩哄噯鍦烘櫙**锛?00 / 1000 / 2000 鑺傜偣锛岃褰?FPS銆佹嫋鎷藉欢杩熴€侀灞忔椂闂淬€?
### 5.2 鍘嗗彶涓庢挙閿€

- 褰撳墠锛氱粨鏋勫彉鏇?鎷栨嫿寮€濮?棣栨缂栬緫鍓?`commit()` 蹇収銆?- 闂锛氭枃鏈紪杈戞瘡娆?focus 鍚庨娆¤緭鍏ユ墠鎻愪氦锛岄€昏緫鍒嗘暎銆?- 璁″垝锛氭娊 `history` 涓棿浠讹紝缁熶竴 `transaction(fn)`锛?  - 缁撴瀯鎿嶄綔鑷姩蹇収锛?  - 杩炵画杈撳叆鍚堝苟涓轰竴娆★紱
  - 鏀寔鍛戒护寮?undo/redo 鍜屽垎缁勩€?
### 5.3 瀛樺偍

- v0.2 淇濇寔 localStorage锛泇0.3 寮曞叆 `StorageAdapter`銆?- JSON schema锛?  ```json
  { "version": 2, "nodes": [], "edges": [], "viewport": { "x": 0, "y": 0, "zoom": 1 } }
  ```
- 杩佺Щ锛歚migrate(snapshot): Snapshot`锛岄€愮増鏈崌绾э紝澶辫触鍥為€€鍒扮┖鐢诲竷骞舵彁绀恒€?- 瀵煎叆鏍￠獙锛氳妭鐐瑰繀椤绘湁 `id/type/position/data`锛岃竟蹇呴』鏈?`id/source/target`銆?
### 5.4 娴嬭瘯

| 灞傜骇 | 宸ュ叿 | 瑕嗙洊 |
| --- | --- | --- |
| 鍗曞厓 | Vitest | store銆乭istory銆乻torage銆佸揩鎹烽敭銆佸鍏ユ牎楠?|
| 缁勪欢 | React Testing Library | NoteNode 缂栬緫銆乀oolbar 鎸夐挳鐘舵€?|
| E2E | Playwright | 鏂板缓銆佽繛绾裤€佹挙閿€銆佸鍏ュ鍑恒€佸埛鏂版仮澶?|
| 鎬ц兘 | 鑷畾涔夎剼鏈?| 500/1000 鑺傜偣 FPS 涓庡唴瀛?|

**璐ㄩ噺闂ㄧ**锛歚tsc -b`銆乣oxlint`銆乣vitest run`銆乣playwright test`銆乣vite build` 鍏ㄩ儴閫氳繃鎵嶈兘鍚堝苟銆?
### 5.5 鍙闂€?
- 鎵€鏈夋寜閽湁 `aria-label` / `title`銆?- 閿洏锛歍ab 鑱氱劍宸ュ叿鏍忥紝Enter/Space 瑙﹀彂锛涜妭鐐圭紪杈戝彲 Esc 閫€鍑恒€?- 棰滆壊瀵规瘮搴?鈮?4.5:1锛涗笉鍙敤棰滆壊琛ㄨ揪鐘舵€併€?- 鍑忓皯鍔ㄧ敾锛歚prefers-reduced-motion`銆?
### 5.6 瀹夊叏

- 瀵煎叆 JSON 鍙帴鍙楃櫧鍚嶅崟瀛楁锛屽拷鐣ユ湭鐭ュ瓧娈点€?- 鍥剧墖 URL 鍙厑璁?`blob:` / `https:`锛屾嫆缁?`javascript:`銆?- 涓嶆墽琛岀敤鎴疯緭鍏ヤ腑鐨?HTML/鑴氭湰銆?- 绗笁鏂逛緷璧栧畾鏈?`npm audit`銆?
---

## 6. 鍙戝竷涓庡紑婧愯繍钀?
### 6.1 鍙戝竷娴佺▼

1. `npm run build` + `lint` + `test` 鍏ㄧ豢銆?2. 鏇存柊 `CHANGELOG.md` 鍜?`package.json` 鐗堟湰銆?3. `git tag v0.x.0` + `git push --tags`銆?4. GitHub Release 鍐欏彉鏇存憳瑕?+ Demo 閾炬帴銆?5. 閮ㄧ讲 GitHub Pages锛坄gh-pages` 鍒嗘敮鎴?Actions锛夈€?
### 6.2 GitHub Pages

- `vite.config.ts` 澧炲姞 `base: '/infinite-canvas/'`锛堥」鐩〉锛夈€?- Actions锛歚npm ci` 鈫?`npm run build` 鈫?涓婁紶 `dist` 鈫?deploy銆?- 鑷畾涔夊煙鍚嶆椂鏀?`base: '/'`銆?
### 6.3 绀惧尯

- Issue 妯℃澘锛欱ug / Feature / Question銆?- PR 妯℃澘锛氭敼浜嗕粈涔堛€佹€庝箞楠岃瘉銆佹埅鍥俱€?- 姣忎袱鍛ㄦ暣鐞嗕竴娆?roadmap 鍜?good first issue銆?- 涓嶈拷姹?star锛屽厛淇濊瘉 3 涓湡瀹炵敤鎴疯兘鐢ㄣ€?
---

## 7. 鎸囨爣

| 鎸囨爣 | v0.1 鐜扮姸 | v0.4 鐩爣 |
| --- | --- | --- |
| 棣栧睆 JS gzip | 145 KB | 鈮?150 KB |
| 1000 鑺傜偣鎷栨嫿 FPS | 60锛坔eadless 鍩哄噯锛?| 鈮?45 |
| 鏍稿績 E2E 鐢ㄤ緥 | 0 | 鈮?8 |
| 鍗曞厓娴嬭瘯 | 79 | 鈮?25 |
| CI 鏃堕暱 | 鏃?| 鈮?3 min |
| 鏂扮敤鎴疯窇璧锋潵 | 闇€鎵嬪姩 | 鈮?3 min |
| Lighthouse Performance | 鏈祴 | 鈮?90 |

---

## 8. 椋庨櫓涓庡簲瀵?
| 椋庨櫓 | 褰卞搷 | 搴斿 |
| --- | --- | --- |
| 鑼冨洿鑶ㄨ儉锛堝崗浣?AI/鎻掍欢涓€璧峰仛锛?| 姘歌繙鍙戜笉鍑?v1.0 | 姣忛樁娈靛彧閫変竴涓柟鍚戯紝鍏朵綑杩?backlog |
| React Flow 澶у浘鎬ц兘鐡堕 | 1000+ 鑺傜偣鍗￠】 | 鍏堝仛鍩哄噯锛屽繀瑕佹椂铏氭嫙鍖?鍒嗗眰娓叉煋 |
| 鎾ら攢璇箟澶嶆潅 | 鐢ㄦ埛涓嶆暍鐢?| 缁熶竴 transaction锛岃ˉ E2E |
| localStorage 瀹归噺/杩佺Щ | 鏁版嵁涓㈠け | v0.3 涓?IndexedDB + schema 杩佺Щ |
| GitHub Pages base 閰嶉敊 | Demo 404 | CI 閲岃窇涓€娆?Pages 鏋勫缓浜х墿妫€鏌?|
| 绗笁鏂?License | 寮€婧愬悎瑙?| MIT + 淇濈暀 React Flow attribution |
| 娌℃湁鐢ㄦ埛 | 鑷棬 | 鍏堢粰 3 涓湅鍙嬭瘯鐢紝鏀堕泦 5 鏉″弽棣?|

---

## 9. 鎺掓湡寤鸿

**鍏艰亴锛堟瘡鍛?8鈥?0 灏忔椂锛?*

| 鍛?| 鍐呭 |
| --- | --- |
| 绗?1 鍛?| 娴嬭瘯 + CI + Pages + README 闂ㄩ潰 |
| 绗?2 鍛?| 鑺傜偣绫诲瀷 + 鍙抽敭鑿滃崟 + 閫変腑宸ュ叿鏍?|
| 绗?3 鍛?| 瀵归綈/鍚搁檮 + 鑷姩甯冨眬 + 杈规牱寮?|
| 绗?4 鍛?| schema/杩佺Щ + IndexedDB + 閿欒杈圭晫 |
| 绗?5 鍛?| 鎬ц兘鍩哄噯 + 浼樺寲 + E2E |
| 绗?6 鍛?| 鍙戝竷 v0.2.0锛屾敹闆嗗弽棣?|
| 绗?7鈥? 鍛?| 閫変竴涓柟鍚戯細AI 鎸囦护鏍?/ 鍗忎綔 / 鎻掍欢 |

**鍏ㄨ亴**锛氱害 2鈥? 鍛ㄥ埌 v0.4 鍙彂甯冪姸鎬併€?
---

## 10. 涓嬩竴涓?Sprint锛?0 涓换鍔★級

鎸変紭鍏堢骇鎺掑簭锛屽彲鐩存帴寮€ issue锛?
1. [x] 鍔?Vitest + store/history/storage 鍗曟祴锛?h锛?2. [x] 鍔?GitHub Actions锛歵ypecheck/lint/test/build锛?h锛?3. [x] 閰?GitHub Pages 閮ㄧ讲锛?h锛?4. [ ] README 鍔?Demo GIF/鎴浘锛?h锛?5. [x] 鍙抽敭鑿滃崟 + 閫変腑宸ュ叿鏍忥紙4h锛?6. [x] 瀵归綈杈呭姪绾?+ 缃戞牸鍚搁檮锛?h锛?7. [x] Dagre 鑷姩甯冨眬锛?h锛?8. [x] Text/Image/Group 鑺傜偣锛?h锛?9. [x] schema 鐗堟湰 + 杩佺Щ锛?h锛?10. [ ] 500/1000 鑺傜偣鎬ц兘鍩哄噯锛?h锛?
---

## 11. 寰呭喅绛?
- [ ] License锛歁IT锛堟帹鑽愶級/ Apache-2.0
- [ ] 閮ㄧ讲锛欸itHub Pages锛堟帹鑽愶級/ Cloudflare Pages / Vercel
- [ ] 鍖呯鐞嗭細npm锛堝綋鍓嶏級/ pnpm
- [ ] 鏄惁淇濈暀 `private: true`锛堝彧褰卞搷 npm 鍙戝竷锛?- [ ] v0.5 鏂瑰悜锛欰I 鎸囦护鏍忥紙鎺ㄨ崘锛屽拰绠€鍘嗕富绾夸竴鑷达級/ 鍗忎綔 / 鎻掍欢

---

## 12. 瀹屾垚瀹氫箟锛圖efinition of Done锛?
涓€涓姛鑳界畻瀹屾垚锛屽繀椤诲悓鏃舵弧瓒筹細

- 浠ｇ爜閫氳繃 `tsc -b`銆乣oxlint`銆佸崟鍏冩祴璇曘€丒2E銆?- 鏈夋槑纭氦浜掑弽棣堬紙hover/disabled/loading/error锛夈€?- 鍒锋柊鍚庢暟鎹?鐘舵€佺鍚堥鏈熴€?- 涓嶅紩鍏ユ湭浣跨敤渚濊禆銆?- README/CHANGELOG 鏈夊搴旇鏄庯紙鍙戝竷闃舵锛夈€?- 鏈夋埅鍥炬垨褰曞睆鍙獙璇併€?
