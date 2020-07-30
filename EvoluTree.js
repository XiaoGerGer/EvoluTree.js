/**
 *
 *
 *
 *         /$$$$$$$$                  /$$        /$$$$$$$$
 *         | $$_____/                 | $$       |__  $$__/
 *         | $$    /$$    /$$ /$$$$$$ | $$ /$$   /$$| $$  /$$$$$$   /$$$$$$   /$$$$$$
 *         | $$$$$|  $$  /$$//$$__  $$| $$| $$  | $$| $$ /$$__  $$ /$$__  $$ /$$__  $$
 *         | $$__/ \  $$/$$/| $$  \ $$| $$| $$  | $$| $$| $$  \__/| $$$$$$$$| $$$$$$$$
 *         | $$     \  $$$/ | $$  | $$| $$| $$  | $$| $$| $$      | $$_____/| $$_____/
 *         | $$$$$$$$\  $/  |  $$$$$$/| $$|  $$$$$$/| $$| $$      |  $$$$$$$|  $$$$$$$
 *         |________/ \_/    \______/ |__/ \______/ |__/|__/       \_______/ \_______/
 *
 *
 *
 * @author Chandler
 */

(function () {

    function EvoluTree(options) {

        const c = {
            LAYOUT_RECTANGULAR: "layout-rectangular",
            LAYOUT_CIRCULAR: "layout-circular",

            SCALE_NONE: "scale_none",
            SCALE_DATE: "scale_date",
            SCALE_DIVERGENCE: "scale_divergence",

            MODE_AUTO: "mode_auto",
            MODE_USE_SCALES: "mode_use_scales",

            CSS_CIRCULAR_BG_CIRCLE: "circular_bg_circle",
            CSS_CIRCULAR_BG_TEXT: "circular_bg_text",
            CSS_LABEL_TEXT: "label_text",
            CSS_FILTERED_LINK: "filtered_link",

            ID_LABEL_TEXT_BG_WHITE: "label-bg-white",
            ID_LABEL_MOUSEOVER: "id_label_mouseover",

            STR_NAME: "name",
            STR_MUTATION: "mutation",
            STR_SORT_ASC: "asc",
            STR_SORT_DESC: "desc",

            COLOR_SCHEMA_NO_COLOR_RENDING: "no_color_rending",
            COLOR_SCHEMA_REGIONS: "regions",
            COLOR_SCHEMA_COUNTRIES_AND_REGIONS: "countries_and_regions",
            COLOR_SCHEMA_GENDER: "gender",
            COLOR_SCHEMA_PATIENT_AGE: "patient_age",
            COLOR_SCHEMA_COLLECTION_DATE: "collection_date",
            COLOR_SCHEMA_CUSTOMIZATION: "customization",

            DATA_FILTER_BY_COUNTRIES: "data_filter_by_countries",
            DATA_FILTER_BY_GENDER: "data_filter_by_gender",
            DATA_FILTER_BY_AGE: "data_filter_by_age",
            DATA_FILTER_BY_DATE: "data_filter_by_date",

            LISTENER_NODE_CLICK: "listener_node_click",
            LISTENER_ZOOM: "listener_zoom",

            ANNOTATION_COVERAGE: "coverage",

            COLOR_PLANS: [
                "OrRd", "RdYlBu", "RdYlGn", "Blues", "Greens", "Oranges",
                "Purples", "Reds", "Warm", "Cool", "BuGn"
            ]
        }

        function Util() {

            function contextMenu(menu, openCallback) {

                const menuDiv = d3.select('div.et-context-menu')
                if (menuDiv.empty()) {
                    d3.select('body').append('div').attr('class', 'et-context-menu')
                }

                d3.select('body').on('click.et-context-menu', function () {
                    menuDiv.style('display', 'none')
                })

                return function (data, index) {
                    const elm = this

                    menuDiv.html('')
                        .append('ul')
                        .selectAll('li')
                        .data(menu)
                        .enter()
                        .append('li')
                        .html(d => d.name)
                        .on('click', function (d, i) {
                            d.action(elm, data, index)
                            menuDiv.style('display', 'none')
                        })

                    // the openCallback allows an action to fire before the menu is displayed
                    // an example usage would be closing a tooltip
                    if (openCallback) openCallback(data, index);

                    // display context menu
                    menuDiv.style('left', (d3.event.pageX - 2) + 'px')
                        .style('top', (d3.event.pageY - 2) + 'px')
                        .style('display', 'block');

                    d3.event.preventDefault();
                };
            }

            function getD3ColorPlan(it) {
                if (typeof it === "string") {
                    const funcName = "interpolate" + it
                    if (!d3.hasOwnProperty(funcName)) {
                        throw new Error("Can't use this color plan, the name is " + it)
                    }
                    return d3[funcName]
                } else if (it instanceof Array) {
                    it = it.map((x) => d3.color(x))
                    return d3.interpolate(...it)
                } else {
                    throw new Error("Can't use this color plan, the name is " + it)
                }
            }

            function parseNwk(nwkStr, options) {

                let parseNodeFunc = function (nodeStr) {
                    const items = nodeStr.split(":")
                    const d = {}

                    if (items[0]) {
                        d.name = items[0]
                    }

                    if (items.length === 2) {
                        d.length = +items[1]
                    }
                    return d
                }

                if (options && options.hasOwnProperty("parseNodeFunc")
                    && typeof options.parseNodeFunc === "function") {
                    parseNodeFunc = options.parseNodeFunc
                }

                function funcProxy(nodeStr) {
                    const node = parseNodeFunc(nodeStr)
                    if (!node) {
                        throw new Error("The parseNodeFunc is return a invalidate value.")
                    }
                    if (!node.hasOwnProperty("length")) {
                        node.length = 0
                    }
                    return node
                }

                nwkStr = nwkStr.replace(";", "").trim()

                let tree = {}

                const ancestors = []
                const tokens = nwkStr.split(/\s*([(),])\s*/)
                let i = 0
                let subtree
                let token
                while (i < tokens.length) {
                    token = tokens[i]
                    switch (token) {
                        case "":
                            break
                        case "(":
                            subtree = {}
                            tree.children = [subtree]
                            ancestors.push(tree)
                            tree = subtree
                            break
                        case ",":
                            subtree = {}
                            ancestors[ancestors.length - 1].children.push(subtree)
                            tree = subtree
                            break
                        case ")":
                            tree = ancestors.pop()
                            break
                        default:
                            Object.assign(tree, funcProxy(token))
                            break
                    }
                    i++
                }
                return tree
            }

            /**
             * Transform 属性辅助
             * @param strOrd3Selector
             * @constructor
             */
            function TransformHelper(strOrd3Selector) {

                let _translate;
                let _scale;
                let _rotate;
                let _skewX;
                let _skewY;

                const pattern = /[a-zA-Z]*\s*\(.*?\)/g
                const translatePattern = /translate\(\s*(.*)\s*,\s*(.*)\s*\)/
                const scalePattern = /scale\(\s*(.*)\s*\)/
                const scalePattern2 = /scale\(\s*(.*)\s*,\s*(.*)\s*\)/
                const rotatePattern = /rotate\(\s*(.*)\s*\)/
                let res = null

                let str = null
                let d3Selector = null

                if (typeof strOrd3Selector == "string") {
                    str = strOrd3Selector
                } else {
                    d3Selector = strOrd3Selector
                    str = d3Selector.attr("transform")
                }

                if (str) {
                    while ((res = pattern.exec(str)) != null) {
                        if (translatePattern.test(res[0])) {
                            _translate = [parseFloat(RegExp.$1), parseFloat(RegExp.$2)]
                        } else if (scalePattern.test(res[0])) {
                            _scale = [parseFloat(RegExp.$1), parseFloat(RegExp.$1)]
                        } else if (scalePattern2.test(res[0])) {
                            _scale = [parseFloat(RegExp.$1), parseFloat(RegExp.$2)]
                        } else if (rotatePattern.test(res[0])) {
                            _rotate = parseFloat(RegExp.$1)
                        }
                    }
                }

                this.setTranslate = function (x, y) {
                    if (!_translate) {
                        _translate = [x, y]
                    } else {
                        _translate[0] = x
                        _translate[1] = y
                    }
                    return this
                }

                this.getTranslate = () => _translate

                this.setScale = function (x, y) {
                    if (!_scale) {
                        _scale = [x, y]
                    } else {
                        _scale[0] = x
                        _scale[1] = y
                    }
                    return this
                }

                this.getScale = () => _scale

                this.setRotate = function (deg) {
                    _rotate = deg
                    return this
                }

                this.getRotate = () => _rotate

                this.apply = function () {
                    if (d3Selector) {
                        d3Selector.attr("transform", this.toString())
                    }
                }

                this.toString = function () {
                    const l = []
                    if (_translate) {
                        l.push(`translate(${_translate[0]},${_translate[1]})`)
                    }
                    if (_scale) {
                        l.push(`scale(${_scale[0]},${_scale[1]})`)
                    }
                    if (_rotate) {
                        l.push(`rotate(${_rotate})`)
                    }
                    return l.join(" ")
                }
            }

            Object.assign(this, {
                parseNwk: parseNwk,
                transformHelper: (strOrd3Selector) => new TransformHelper(strOrd3Selector),
                getD3ColorPlan: getD3ColorPlan,
                contextMenu: contextMenu,
            })
        }

        function DataManager() {

            let tree, attachInformationListener, existOutGroup = false, exclusiveOutGroupPart
            const statInfo = {
                length: null,
            }
            const colorSchemas = {}

            function addColorSchema(options) {

                const obj = {}

                if (options.hasOwnProperty("scaleName")) {
                    // color by scale
                    obj.colorSchemaName = options.name
                    obj.colorPlan = options.colorPlan
                    obj.scaleName = options.scaleName
                    obj.dataScale = layoutManager.getScales()[options.scaleName]
                    obj.colorScale = obj.dataScale.scale.copy().range([0, 1])
                    obj.interpolate = util.getD3ColorPlan(obj.colorPlan)
                    obj.apply = function (tree) {
                        tree.each(function (d) {
                            if (!d.data.hasOwnProperty("custom")) {
                                d.data.custom = {}
                            }
                            d.data.custom.lc = obj.interpolate(obj.colorScale(obj.dataScale.scaleConfig.field(d)))
                            d.data.custom.nc = d.data.custom.lc
                        })
                    }
                    colorSchemas[obj.colorSchemaName] = obj
                } else {
                    // color by custom
                    obj.colorSchemaName = options.name
                    obj.apply = options.setColor
                }
                colorSchemas[obj.colorSchemaName] = obj
            }

            function switchColorSchemaTo(colorSchemaName) {
                colorSchemas[colorSchemaName].apply(tree)
                layoutManager.refresh()
            }

            function loadFromNwk(nwkStr, options) {
                return loadFromObject(util.parseNwk(nwkStr, options))
            }

            function loadFromJson(jsonStr) {
                return loadFromObject(JSON.parse(jsonStr))
            }

            function loadFromObject(obj) {
                tree = d3.hierarchy(obj)

                // 判断数据中是否包含外群
                if (tree.children) {
                    existOutGroup = tree.children.map(d => d.data.isOutGroup).includes(true)
                }

                // 获取不包含外群的那一部分数据
                if (existOutGroup) {
                    for (const child of tree.children) {
                        if (!child.data.isOutGroup) {
                            exclusiveOutGroupPart = child
                            break
                        }
                    }
                }

                let index = 0
                tree.eachBefore(function (node) {
                    node.data._i = "i" + index++

                    if (!node.parent) {
                        node.data.lengthSum = node.data.length || 0
                    } else {
                        node.data.lengthSum = node.data.length + node.parent.data.lengthSum
                    }

                    statLengthSum(node)
                    // stat(node)

                    if (attachInformationListener) {
                        attachInformationListener(node)
                    }
                })
                return this
            }

            function statLengthSum(node) {
                if (node.data.lengthSum) {
                    if (!statInfo.length) {
                        statInfo.length = [node.data.lengthSum, node.data.lengthSum]
                    }
                    if (node.data.lengthSum < statInfo.length[0]) {
                        statInfo.length[0] = node.data.lengthSum
                    }
                    if (node.data.lengthSum > statInfo.length[1]) {
                        statInfo.length[1] = node.data.lengthSum
                    }
                }
            }

            function statByScale(scale) {
                statInfo[scale.name] = null
                let value
                tree.eachBefore(function (it) {
                    value = scale.field(it)
                    if (!statInfo[scale.name]) {
                        statInfo[scale.name] = [value, value]
                    } else if (value < statInfo[scale.name][0]) {
                        statInfo[scale.name][0] = value
                    } else if (value > statInfo[scale.name][1]) {
                        statInfo[scale.name][1] = value
                    }
                })
            }

            function setAttachInformationListener(listener) {
                attachInformationListener = listener
            }

            function exportJson() {

            }

            function markAnnotation(node, annoType, args) {
                node.data.annotation = {
                    type: annoType,
                    args: args
                }
            }

            function clearAnnotationMarks() {
                tree.each(function (node) {
                    if (node.data.annotation) {
                        delete node.data.annotation
                    }
                })
            }

            function getSelected() {
                return tree.descendants().filter(d => d.data.isHighlight)
            }

            function collapse(bool, nodes) {
                let func
                if (bool) {
                    func = function (node) {
                        if (node.data.isCollapsed) {
                            return
                        }
                        node.data.isCollapsed = true
                        node._children = node.children
                        delete node.children
                    }
                } else {
                    func = function (node) {
                        if (!node.data.isCollapsed) {
                            return
                        }
                        delete node.data.isCollapsed
                        node.children = node._children
                        delete node._children
                    }
                }
                nodes.forEach(func)
                layoutManager.refresh()
            }

            Object.assign(this, {
                loadFromNwk: loadFromNwk,
                loadFromJson: loadFromJson,
                loadFromObject: loadFromObject,
                getTree: () => tree,
                getStatInfo: () => statInfo,
                existOutGroup: () => existOutGroup,
                exclusiveOutGroupPart: () => exclusiveOutGroupPart,
                statByScale: statByScale,
                addColorSchema: addColorSchema,
                switchColorSchemaTo: switchColorSchemaTo,
                getSelected: getSelected,
                collapse: collapse,
                clearAnnotationMarks: clearAnnotationMarks,
                markAnnotation: markAnnotation,
            })
        }

        function LayoutManager() {

            const cfg = {
                // 宽，默认计算获得
                width: null,
                // 高，默认计算获得
                height: null,
                // 整体内边距
                padding: 0.05,
                // 是否开启动画
                animation: true,
                // 是否允许多选
                multipleSelect: false,
                // 是否允许右键菜单
                contextMenu: true,
                // 是否允许放大缩小
                zoomable: true,

                onNodeMouseover: null,
                onNodeMouseout: null,
                onNodeLeftClick: null,
                onNodeRightClick: null,

                onLineMouseover: null,
                onLineMouseout: null,
                onLineLeftClick: null,
                onLineRightClick: null,

                onLabelMouseover: null,
                onLabelMouseout: null,

                onZoom: null,

                annotations: {
                    show: true,
                },
                outGroup: {
                    show: false,
                    dash: "2,2",
                },
                lines: {
                    show: true,
                    color: "#ddddddee",
                    thickness: 1,
                    mouseOverFactor: 3,
                    highlightFactor: 5,
                },
                rootLine: {
                    show: true,
                    length: 0,
                },
                background: {
                    show: true,
                    color: "#dddddd88",
                    thickness: 1,
                    fontColor: "#969696",
                    fontSize: 8,
                },
                alignToTips: {
                    show: false,
                    color: "#C0C0C0",
                    thickness: 1,
                    dash: "1,1",
                },
                nodes: {
                    show: false,
                    radius: 2,
                    mouseOverFactor: 1.5,
                    highlightFactor: 2,
                    collapseMarkSize: 16,
                },
                leafLabels: {
                    show: false,
                    color: "red",
                    margin: 8,
                    fontSize: 2.5,
                    mouseOverFactor: 1.5,
                    radiusSpace: 18,
                },
            }

            const layouts = {
                [c.LAYOUT_CIRCULAR]: new CircularLayout(),
                [c.LAYOUT_RECTANGULAR]: new RectangularLayout(),
            }

            let containerSelector, container, svg, gRoot, gBackground,
                gLine, gNode, gLabel, gMark, gTip

            const scales = {_none: null, _current: null}
            const status = {
                mode: c.MODE_AUTO,
                layout: c.LAYOUT_CIRCULAR,
            }

            const zoomRange = [0.1, 10]

            const scaleZoom = d3.scaleLinear().domain([0, 100]).range(zoomRange)

            const zoom = d3.zoom().scaleExtent(scaleZoom.range()).on('zoom', zoomed)

            function zoomed() {
                if (d3.event.transform) {

                    // 该方式缺少 rotate，不采用
                    // rootG.attr("transform", d3.event.transform)

                    // 由于 d3.event.transform 种不包含 rotate ，所以为了避免丢失 rotate 信息，此处封装了一下 Transform
                    util.transformHelper(gRoot)
                        .setScale(d3.event.transform.k, d3.event.transform.k)
                        .setTranslate(d3.event.transform.x, d3.event.transform.y)
                        .apply()

                    if (cfg.onZoom) cfg.onZoom(scaleZoom.invert(d3.event.transform.k))
                }
            }

            function setContainer(select) {
                containerSelector = select
                container = d3.select(select)

                if (container.empty()) {
                    throw new Error()
                }

                cfg.width = container.node().getBoundingClientRect().width
                cfg.height = container.node().getBoundingClientRect().height

                initSVG()
                setSVGBox()
            }

            function setSVGBox() {
                svg.attr("width", cfg.width)
                    .attr("height", cfg.height)
                    .attr("viewBox", `0,0,${cfg.width},${cfg.height}`)
            }

            function initSVG() {

                svg = container.append("svg").attr("class", "et-svg")

                svg.append("defs").html(`

            <filter x="0" y="0" width="1" height="1" id="${c.ID_LABEL_TEXT_BG_WHITE}">
                <feFlood flood-color="white"/>
                <feComposite in="SourceGraphic" in2=""/>
            </filter>
            
            <filter x="0" y="0" width="1" height="1" id="${c.ID_LABEL_MOUSEOVER}">
                <feFlood flood-color="blue"/>
                <feComposite in="SourceGraphic" in2=""/>
            </filter>
            
            <g id="collapse-mark">
                    <circle stroke-width="12" stroke="#e6e6e6" cx="512" cy="512" r="500"></circle>
                    <path fill="white" d="M810.666667 384h-110.08l140.373333-140.373333a42.666667 42.666667 0 1 0-60.586667-60.586667L640 322.986667V213.333333a42.666667 42.666667 0 0 0-42.666667-42.666666 42.666667 42.666667 0 0 0-42.666666 42.666666v213.333334a42.666667 42.666667 0 0 0 42.666666 42.666666h213.333334a42.666667 42.666667 0 0 0 0-85.333333zM426.666667 554.666667H213.333333a42.666667 42.666667 0 0 0 0 85.333333h109.653334l-139.946667 140.373333a42.666667 42.666667 0 0 0 0 60.586667 42.666667 42.666667 0 0 0 60.586667 0L384 700.586667V810.666667a42.666667 42.666667 0 0 0 42.666667 42.666666 42.666667 42.666667 0 0 0 42.666666-42.666666v-213.333334a42.666667 42.666667 0 0 0-42.666666-42.666666z"></path>
            </g>
            
            
            `)

                gRoot = svg.append("g").attr("class", "root")
                gBackground = gRoot.append("g").attr("class", "background")
                gMark = gRoot.append("g").attr("class", "mark")
                gLine = gRoot.append("g").attr("class", "line")
                gNode = gRoot.append("g").attr("class", "node")
                gLabel = gRoot.append("g").attr("class", "label")
                gTip = gRoot.append("g").attr("class", "tip")

                if (cfg.zoomable) {
                    svg.call(zoom)
                }
            }

            function resize() {
                cfg.width = container.node().getBoundingClientRect().width
                cfg.height = container.node().getBoundingClientRect().height

                setSVGBox()

                Object.values(layouts).forEach(function (layout) {
                    layout.hasOwnProperty("onResize") && layout.onResize()
                })
            }

            function destroy() {

            }

            function setRotate(val) {
                util.transformHelper(gRoot).setRotate(val).apply()
            }

            /**
             * 添加一种比例尺
             * {
             *     name: "Length",
             *     type: "number" || "time",
             *     field: (d) => d.data.length
             * }
             * @param scaleConfig
             */
            function addBranchScale(scaleConfig) {
                dataManager.statByScale(scaleConfig)
                scales[scaleConfig.name] = {
                    scaleConfig: scaleConfig
                }
                let scale
                if (scaleConfig.type === "number") {
                    scale = d3.scaleLinear()
                } else if (scaleConfig.type === "time") {
                    scale = d3.scaleTime()
                } else {
                    throw new Error("Oh! man, what are you doing. I got a error type.")
                }
                scale.domain(dataManager.getStatInfo()[scaleConfig.name])
                scales[scaleConfig.name].scale = scale
            }

            function switchScaleTo(scaleName) {
                if (scaleName === null || scaleName.toLowerCase() === "none") {
                    status.mode = c.MODE_AUTO
                } else {
                    status.mode = c.MODE_USE_SCALES
                }
                scales._current = scales[scaleName]
            }

            function switchLayoutTo(layoutName) {
                if (!layouts[layoutName]) {
                    throw new Error("Not support layout, the name is " + layoutName)
                }
                layouts[status.layout].onPause()
                status.layout = layoutName

                cfg.animation = false
                layouts[status.layout].onResume()
                cfg.animation = true
            }

            function getShowingData() {
                if (!cfg.outGroup.show || !dataManager.existOutGroup()) {
                    return dataManager.getTree()
                } else {
                    return dataManager.exclusiveOutGroupPart()
                }
            }

            function RectangularLayout() {
                const box = {left: 0, width: 0, top: 0, height: 0}
                const axisOptions = {
                    height: 20,
                    paddingTop: 8,
                }

                function onResume() {
                    removeBackgroundGrid()
                    removeMark()
                    selfBox()

                    zoom.scaleTo(svg, 1)
                    let t = util.transformHelper(gRoot).getTranslate()
                    if (!t || t.length !== 2) {
                        t = [0, 0]
                    }
                    zoom.translateBy(svg, -t[0], -t[1])
                    refresh()
                    // boundMouseMoveTipLine()
                }

                function onPause() {
                }

                function boundMouseMoveTipLine() {
                    const lineX = gTip.append("line")
                        .attr("class", "tip-line-x")
                        .attr("stroke-width", 1)
                        .attr("stroke", "red")
                        .attr("x1", 0)
                        .attr("y1", box.top)
                        .attr("x2", 0)
                        .attr("y2", box.top + box.height)

                    svg.on("mousemove", function () {
                        const x = d3.mouse(this)[0]
                        lineX.attr("x1", x).attr("x2", x)
                    }).on("mouseleave", function () {
                        lineX.attr("x1", -1).attr("x2", -1)
                    })
                }

                function selfBox() {
                    box.left = cfg.width * cfg.padding / 2
                    box.width = cfg.width * (1 - cfg.padding)
                    box.top = cfg.height * cfg.padding / 2
                    box.height = cfg.height * (1 - cfg.padding)
                }

                function refresh() {
                    draw()
                }

                function calcLayout() {
                    let cluster = d3.cluster()
                        .size([status.mode === c.MODE_USE_SCALES ? box.height - axisOptions.height : box.height, box.width])
                        .separation((a, b) => 1)

                    cluster(getShowingData())

                    getShowingData().each(function (d) {
                        [d.x, d.y] = [d.y, d.x]

                        d.x += box.left
                        d.y += box.top

                        if (d.data.isOutGroup) {
                            d.x = scales._current.scale.range()[1]
                        } else {
                            switch (status.mode) {
                                case c.MODE_AUTO:
                                    // nothing in here
                                    break
                                case c.MODE_USE_SCALES:
                                    d.x = scales._current.scale(scales._current.scaleConfig.field(d))
                                    break
                                default:
                                    break
                            }
                        }
                    })
                }

                function draw() {

                    if (scales._current) {
                        scales._current.scale.range([box.left, box.left + box.width])
                    } else {
                        // nothing in here
                    }

                    if (status.mode === c.MODE_USE_SCALES) {
                        drawBackgroundGrid()
                    } else {
                        removeBackgroundGrid()
                    }

                    calcLayout()
                    drawLines()
                    drawMarks()

                    if (cfg.showAnnotations) drawAnnotations()
                    if (cfg.showNodes) drawNodes()
                    if (cfg.showRootLine) drawRootLine()
                    if (cfg.alignToTips) drawAlignToTipLine()
                }

                function drawBackgroundGrid() {

                    const scale = scales._current.scale
                    const ticks = scale.ticks()

                    const gAxis = gBackground.append("g")
                        .attr("class", "axis")
                        .attr('transform', `translate(0,${box.top + box.height - axisOptions.height + axisOptions.paddingTop})`)
                    const axis = d3.axisBottom(scale).tickValues(ticks)

                    gAxis.call(axis)

                    const gAxisLine = gBackground.append("g")
                        .attr("class", "axis-line")

                    gAxisLine.selectAll("line")
                        .data(ticks)
                        .enter()
                        .append("line")
                        .attr("x1", d => scale(d))
                        .attr("y1", box.top)
                        .attr("x2", d => scale(d))
                        .attr("y2", box.top + box.height - axisOptions.height)
                        .attr("stroke", cfg.backgroundLineColor)
                        .attr("stroke-width", cfg.backgroundLineSize)
                }

                function drawNodes() {
                    // 过滤掉被过滤的数据
                    let nodeUpdate = gNode.selectAll("circle.node")
                        .data(getShowingData()
                            .descendants()
                            .filter(d => !d.data.isFiltered && !d.data.isCollapsed))
                    let nodeExit = nodeUpdate.exit()
                    let nodeEnter = nodeUpdate.enter()

                    nodeExit.remove()
                    nodeEnter = nodeEnter.append("circle").attr("class", "node")

                    for (let it of [nodeUpdate, nodeEnter]) {
                        it.on("mouseover", nodeMouseOver)
                            .on("mouseout", nodeMouseOut)
                            .on("click", nodeClick)

                        if (cfg.animation) it = it.transition()

                        it.attr("fill", nodeColor)
                            .attr("r", nodeSize)
                            .attr("id", d => d.data._i)
                            .attr("cx", d => d.x)
                            .attr("cy", d => d.y)
                    }
                }

                function drawMarks() {

                }

                function drawRootLine() {

                }

                function drawLines() {
                    let linkUpdate = gLine.selectAll("path.line").data(getShowingData().links())
                    let linkExit = linkUpdate.exit()
                    let linkEnter = linkUpdate.enter()

                    linkExit.remove()
                    linkEnter = linkEnter.append("path").attr("class", "line")

                    for (let it of [linkUpdate, linkEnter]) {

                        it.on("mouseover", lineMouseover)
                            .on("mouseout", lineMouseout)
                            .on("contextmenu", lineRightClick)
                            .on("click", lineLeftClick)

                        if (cfg.animation) it = it.transition()

                        it.attr("d", rectangularLine)
                            .attr("fill", "none")
                            .attr("id", d => d.target.data._i)
                            .attr("stroke-width", lineSize)
                            .attr("stroke", lineColor)
                            .attr("stroke-dasharray", lineDash)
                            .attr("class", lineClass)
                    }
                }

                function rectangularLine(d) {
                    return `M${d.source.x},${d.source.y} L${d.source.x},${d.target.y} L${d.target.x},${d.target.y}`
                }

                function drawAlignToTipLine() {

                }

                function drawLabels() {

                }

                function drawAnnotations() {

                }

                Object.assign(this, {
                    onPause: onPause,
                    onResume: onResume,
                    refresh: refresh,
                })
            }

            function CircularLayout() {

                let degree = {start: 0, extent: 360}
                let radius = {min: 20, max: Math.min(cfg.width, cfg.height) / 2 * (1 - cfg.padding)}
                let rootMarginToChildren = 10
                let cluster = d3.cluster().separation((a, b) => 1)

                function onResize() {
                    moveLayoutToCenterAndRefresh()
                }

                function onResume() {
                    moveLayoutToCenterAndRefresh()
                }

                function onPause() {
                }

                function moveLayoutToCenterAndRefresh() {
                    removeBackgroundGrid()
                    removeMark()

                    radius.max = Math.min(cfg.width, cfg.height) / 2 * (1 - cfg.padding)

                    moveToCenter()
                    refresh()
                }

                function refresh() {
                    draw()
                }

                function showLeafLabel(bool) {
                    cfg.showLeafLabel = bool
                    refresh()
                }

                function showNodes(bool) {
                    cfg.showNodes = bool
                    refresh()
                }

                function setStartDegree(val) {
                    degree.start = val
                    refresh()
                }

                function setExtentDegree(val) {
                    degree.extent = val
                    refresh()
                }

                // -------------------------------------------------------------------------------------------------------------

                function calcLayout() {
                    const clusterDegree = degree.extent
                    let clusterRadius = (scales._current ? scales._current.scale.range()[1] : radius.max - radius.min)
                    if (cfg.leafLabels.show) {
                        clusterRadius -= cfg.leafLabels.radiusSpace
                    }
                    cluster.separation((a, b) => a.data.isCollapsed || b.data.isCollapsed ? 3 : 1)
                        .size([clusterDegree, clusterRadius])(getShowingData())


                    getShowingData().eachBefore(function (d) {
                        if (d.parent == null) {
                            d.radius = radius.min
                        } else if (d.data.isOutGroup) {
                            d.radius = radius.max
                        } else {
                            switch (status.mode) {
                                case c.MODE_AUTO:
                                    d.radius = d.y + radius.min
                                    break
                                case c.MODE_USE_SCALES:
                                    d.radius = scales._current.scale(scales._current.scaleConfig.field(d))
                                    break
                                default:
                                    break
                            }
                        }
                        // 角度（默认 0 度的时候是 15:00 钟方向）
                        d.angle = d.x
                        // 此处将角度加上 startDegree
                        d.angle += degree.start
                        // 根据角度和半径计算出该节点的坐标
                        d.y = Math.sin(d.angle * (Math.PI / 180)) * d.radius
                        d.x = Math.cos(d.angle * (Math.PI / 180)) * d.radius
                    })
                }

                function draw() {

                    if (cfg.rootLine.length) {
                        radius.min = cfg.rootLine.length
                    }

                    if (scales._current) {
                        let rangeMax = radius.max
                        if (cfg.leafLabels.show) {
                            rangeMax -= cfg.leafLabels.radiusSpace
                        }
                        scales._current.scale.range([radius.min, rangeMax])
                    }

                    calcLayout()

                    drawMarks()

                    cfg.lines.show ? drawLines() : null
                    cfg.background.show && status.mode === c.MODE_USE_SCALES ? drawBackgroundGrid() : removeBackgroundGrid()
                    cfg.rootLine.show ? drawRootLine() : removeRootLine()
                    cfg.annotations.show ? drawAnnotations() : removeAnnotations()
                    cfg.nodes.show ? drawNodes() : removeNodes()
                    cfg.alignToTips.show ? drawAlignToTipLine() : removeAlignToTipLine()
                    cfg.leafLabels.show ? drawLeafLabel() : removeLeafLabel()
                }

                /**
                 * 绘制节点
                 */
                function drawNodes() {
                    // 过滤掉被过滤的数据
                    let nodeUpdate = gNode.selectAll("circle")
                        .data(getShowingData()
                            .descendants()
                            .filter(d => !d.data.isFiltered && !d.data.isCollapsed))
                    let nodeExit = nodeUpdate.exit()
                    let nodeEnter = nodeUpdate.enter()

                    nodeExit.remove()
                    nodeEnter = nodeEnter.append("circle")

                    for (let it of [nodeUpdate, nodeEnter]) {
                        it.on("mouseover", nodeMouseOver)
                            .on("mouseout", nodeMouseOut)
                            .on("click", nodeClick)

                        if (cfg.animation) it = it.transition()

                        it.attr("fill", nodeColor)
                            .attr("r", nodeSize)
                            .attr("id", d => d.data._i)
                            .attr("cx", d => d.x)
                            .attr("cy", d => d.y)

                    }
                }

                /**
                 * 绘制标记（折叠标记...）
                 */
                function drawMarks() {
                    const collapseNodes = getShowingData().descendants().filter(d => d.data.isCollapsed)

                    let u = gMark.selectAll("svg.collapse-mark-svg").data(collapseNodes)
                    u.exit().remove()
                    let e = u.enter()

                    e = e.append("svg").attr("class", "collapse-mark-svg")

                    for (let it of [u, e]) {
                        it.on("mouseover", nodeMouseOver)
                            .on("mouseout", nodeMouseOut)

                        it.attr("viewBox", "0 0 1024 1024")
                            .attr("width", cfg.nodes.collapseMarkSize)
                            .attr("height", cfg.nodes.collapseMarkSize)
                            .attr("x", d => d.x - cfg.nodes.collapseMarkSize / 2)
                            .attr("y", d => d.y - cfg.nodes.collapseMarkSize / 2)
                            .append("use")
                            .attr("xlink:href", "#collapse-mark")
                            .attr("id", d => d.data._i)
                            .attr("fill", nodeColor)
                    }
                }

                /**
                 * 绘制节点之间的连线
                 */
                function drawLines() {
                    let linkUpdate = gLine.selectAll("path.line").data(getShowingData().links())
                    let linkExit = linkUpdate.exit()
                    let linkEnter = linkUpdate.enter()

                    linkExit.remove()
                    linkEnter = linkEnter.append("path").attr("class", "line")

                    for (let it of [linkUpdate, linkEnter]) {
                        it.on("mouseover", lineMouseover)
                            .on("mouseout", lineMouseout)
                            .on("click", lineLeftClick)
                            .on("contextmenu", lineRightClick)

                        if (cfg.animation) it = it.transition()

                        it.attr("d", arcAndLine)
                            .attr("fill", "none")
                            .attr("id", d => d.target.data._i)
                            .attr("stroke-width", lineSize)
                            .attr("stroke", lineColor)
                            .attr("stroke-dasharray", lineDash)
                            .attr("class", lineClass)
                    }
                }

                function drawRootLine() {

                    let rootLineUpdate = gLine.selectAll("path.root")
                        .data([{
                            source: null,
                            target: getShowingData(),
                        }])
                    let rootLineExit = rootLineUpdate.exit()
                    let rootLineEnter = rootLineUpdate.enter()

                    rootLineExit.remove()
                    rootLineEnter = rootLineEnter.append("path").attr("class", "line root")

                    for (let it of [rootLineUpdate, rootLineEnter]) {
                        it.on("mouseover", lineMouseover)
                            .on("mouseout", lineMouseout)
                            .on("click", lineLeftClick)

                        it.attr("d", d => `M0, 0 L${d.target.x},${d.target.y}`)
                            .attr("id", d => d.target.data._i)
                            .attr("stroke-width", lineSize)
                            .attr("stroke", lineColor)
                    }
                }

                function drawBackgroundGrid() {

                    const scale = scales._current.scale
                    const ticks = scale.ticks()

                    // 画圈圈
                    let circleUpdate = gBackground.selectAll("circle.background-circle").data(ticks)
                    let circleExit = circleUpdate.exit()
                    let circleEnter = circleUpdate.enter()

                    circleExit.remove()
                    circleEnter = circleEnter.append('circle').attr("class", "background-circle")

                    for (let it of [circleUpdate, circleEnter]) {
                        if (cfg.animation) it = it.transition()
                        it.attr("r", d => scale(d))
                            .attr("fill", "transparent")
                            .attr("stroke", cfg.background.color)
                            .attr("stroke-width", cfg.background.thickness)
                    }

                    // 画文字
                    let labelUpdate = gBackground.selectAll("text.background-text").data(ticks)
                    let labelExit = labelUpdate.exit()
                    let labelEnter = labelUpdate.enter()

                    labelExit.remove()
                    labelEnter = labelEnter.append("text").attr("class", "background-text")
                    let labelAngle = 90
                    for (let it of [labelUpdate, labelEnter]) {
                        if (cfg.animation) it = it.transition()
                        it.attr("y", d => 3 + Math.sin(labelAngle * (Math.PI / 180)) * scale(d))
                            .attr("x", d => Math.cos(labelAngle * (Math.PI / 180)) * scale(d))
                            .text(d => d)
                            .attr("filter", `url(#${c.ID_LABEL_TEXT_BG_WHITE})`)
                            .attr("text-anchor", "middle")
                            .attr("fill", cfg.background.fontColor)
                            .attr("font-size", cfg.background.fontSize)
                    }
                }

                /**
                 * 画 Annotation
                 */
                function drawAnnotations() {
                    gMark.selectAll("g.annotation").remove()
                    const annotationNodes = getShowingData()
                        .descendants()
                        .filter(d => d.data.annotation)

                    for (const node of annotationNodes) {
                        const annotation = node.data.annotation
                        const type = annotation.type
                        const args = annotation.args

                        switch (type) {
                            case c.ANNOTATION_COVERAGE:
                                annotationCoverage(node, args)
                                break
                            default:
                                break
                        }
                    }
                }

                function drawAlignToTipLine() {
                    let alignLineUpdate = gLine.selectAll("path.align-to-tip")
                        .data(getShowingData().leaves().filter(d => !d.data.isFiltered))
                    let alignLineExit = alignLineUpdate.exit()
                    let alignLineEnter = alignLineUpdate.enter()

                    alignLineExit.remove()
                    alignLineEnter = alignLineEnter.append("path").attr("class", "align-to-tip")

                    let r = radius.max
                    if (scales._current) {
                        r = scales._current.scale.range()[1]
                    } else if (cfg.leafLabels.show) {
                        r = radius.max - cfg.leafLabels.radiusSpace
                    }

                    for (let it of [alignLineUpdate, alignLineEnter]) {

                        it.attr("stroke", alignToTipLineStroke)
                            .attr("stroke-width", cfg.alignToTips.thickness)
                            .attr("stroke-dasharray", cfg.alignToTips.dash)
                            .attr("fill", "none")
                            .attr("d", function (d) {
                                let x1 = d.x, y1 = d.y
                                let x2 = Math.cos(d.angle * (Math.PI / 180)) * r
                                let y2 = Math.sin(d.angle * (Math.PI / 180)) * r
                                return `M${x1},${y1} L${x2},${y2}`
                            })
                    }
                }

                function drawLeafLabel() {
                    let alignLineUpdate = gLabel.selectAll("text.leaf-label")
                        .data(getShowingData().leaves().filter(d => !d.data.isFiltered))
                    let alignLineExit = alignLineUpdate.exit()
                    let alignLineEnter = alignLineUpdate.enter()

                    alignLineExit.remove()
                    alignLineEnter = alignLineEnter.append("text").attr("class", "leaf-label")

                    let r = radius.max - cfg.leafLabels.radiusSpace + cfg.leafLabels.margin

                    for (let it of [alignLineUpdate, alignLineEnter]) {
                        it.on("mouseover", labelMouseover)
                            .on("mouseout", labelMouseout)

                        it.attr("id", d => d.data._i)
                            .attr("font-size", cfg.leafLabels.fontSize)
                            .attr("fill", leafLabelColor)
                            .attr("transform", function (d) {
                                const x = r * Math.cos(d.angle * Math.PI / 180)
                                const y = r * Math.sin(d.angle * Math.PI / 180)
                                return `rotate(${d.angle},${x},${y})`
                            })
                            .attr("x", function (d) {
                                return Math.cos(d.angle * (Math.PI / 180)) * r
                            })
                            .attr("y", function (d) {
                                return Math.sin(d.angle * (Math.PI / 180)) * r
                            })
                            .attr("filter", function (d) {
                                if (d.data.custom && d.data.custom.hasOwnProperty("tbc")) {
                                    return `url(#${d.data.custom.tbc})`
                                } else {
                                    return null
                                }
                            })
                            .text(d => d.data.name)

                    }
                }

                function removeRootLine() {
                    gLine.select("path.root").remove()
                }

                function removeLeafLabel() {
                    gLabel.selectAll("text.leaf-label").remove()
                }

                function removeAlignToTipLine() {
                    gLine.selectAll("path.align-to-tip").remove()
                }

                function removeNodes() {
                    gNode.selectAll("circle").remove()
                }

                function removeAnnotations() {

                }

                /**
                 * 注释 Internal node to leaf
                 * @param branch
                 * @param args
                 */
                function annotationCoverage(branch, args) {
                    const leaves = branch.leaves()
                    const startNode = leaves[0]
                    const endNode = leaves[leaves.length - 1]
                    const startAngle = startNode.angle
                    const endAngle = endNode.angle

                    const sweepFlag = 1
                    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

                    const p1Radius = scales._current ? scales._current.scale.range()[1] : radius.max
                    const p1Angle = startAngle
                    const p1x = p1Radius * Math.cos(p1Angle * Math.PI / 180)
                    const p1y = p1Radius * Math.sin(p1Angle * Math.PI / 180)

                    const p2Radius = p1Radius
                    const p2Angle = endAngle
                    const p2x = p2Radius * Math.cos(p2Angle * Math.PI / 180)
                    const p2y = p2Radius * Math.sin(p2Angle * Math.PI / 180)

                    const p3Radius = branch.radius
                    const p3Angle = endAngle
                    const p3x = p3Radius * Math.cos(p3Angle * Math.PI / 180)
                    const p3y = p3Radius * Math.sin(p3Angle * Math.PI / 180)

                    const p4Radius = branch.radius
                    const p4Angle = startAngle
                    const p4x = p4Radius * Math.cos(p4Angle * Math.PI / 180)
                    const p4y = p4Radius * Math.sin(p4Angle * Math.PI / 180)

                    const d = `M${p1x},${p1y}
        A${p1Radius},${p1Radius} 0 ${largeArcFlag} ${sweepFlag} ${p2x},${p2y} 
        L${p3x},${p3y}
        A${p4Radius},${p4Radius} 0 ${largeArcFlag} ${0} ${p4x},${p4y} 
        L${p1x},${p1y}`

                    const g = gMark.append("g").attr("class", "annotation")

                    g.append("path")
                        .attr("fill", args.shapeColor)
                        .attr("d", d)
                }

                function alignToTipLineStroke(d) {
                    if (d.data.custom && d.data.custom.hasOwnProperty("lc") && d.data.custom.lc) {
                        return d.data.custom.lc
                    } else {
                        return cfg.alignToTips.color
                    }
                }

                /**
                 * 起始点画弧线到中间点，中间点画直线到结束点
                 * @param d
                 * @returns {string}
                 */
                function arcAndLine(d) {
                    const s = d.source
                    const t = d.target
                    const sweepFlag = t.angle > s.angle ? 1 : 0

                    // 求中间点坐标
                    // 已知角度、已知半径，求坐标
                    const pRadius = s.radius
                    const pAngle = t.angle
                    const px = pRadius * Math.cos(pAngle * Math.PI / 180)
                    const py = pRadius * Math.sin(pAngle * Math.PI / 180)

                    // SVG PATH d 画弧
                    // 指令	A (绝对) a (相对)
                    // 名称	elliptical arc 椭圆弧
                    // 参数	(rx ry x-axis-rotation large-arc-flag sweep-flag x y)+
                    //
                    // rx ry 是椭圆的两个半轴的长度。
                    // x-axis-rotation 是椭圆相对于坐标系的旋转角度，角度数而非弧度数。
                    // large-arc-flag 是标记绘制大弧(1)还是小弧(0)部分。
                    // sweep-flag 是标记向顺时针(1)还是逆时针(0)方向绘制。
                    // x y 是圆弧终点的坐标。
                    //
                    // 描述：
                    // 从当前点绘制一段椭圆弧到点 (x, y)，椭圆的大小和方向由 (rx, ry) 和 x-axis-rotation 参数决定，
                    // x-axis-rotation 参数表示椭圆整体相对于当前坐标系统的旋转角度。椭圆的中心坐标 (cx, cy) 会自动进行计算从而满足其它参数约束。
                    // large-arc-flag 和 sweep-flag 也被用于圆弧的计算与绘制。

                    return `M${s.x},${s.y} 
                 A${s.radius},${s.radius} 0 0 ${sweepFlag} ${px},${py} 
                 L${t.x},${t.y}`
                }

                // -------------------------------------------------------------------------------------------------------------

                Object.assign(this, {
                    onPause: onPause,
                    onResume: onResume,
                    refresh: refresh,
                    moveLayoutToCenterAndRefresh: moveLayoutToCenterAndRefresh,
                    setStartDegree: setStartDegree,
                    setExtentDegree: setExtentDegree,
                    onResize: onResize,
                })
            }

            //////////////////////////////////////////////////////////////////////////////////////////////

            function moveToCenter() {
                zoom.scaleTo(svg, 1)
                let t = util.transformHelper(gRoot).getTranslate()
                if (!t || t.length !== 2) {
                    t = [0, 0]
                }
                const newX = cfg.width / 2 - t[0]
                const newY = cfg.height / 2 - t[1]
                zoom.translateBy(svg, newX, newY)

            }

            function removeBackgroundGrid() {
                gBackground.selectAll("*").remove()
            }

            function removeMark() {
                gMark.selectAll("*").remove()
            }

            function selectOne(d) {

                d.data.isHighlight = true
                let i = d.data._i

                let a = gNode.select("circle#" + i).on("mouseover", null).on("mouseout", null)

                if (!a.empty()) {
                    let or = cfg.nodes.radius
                    let r = cfg.nodes.radius * cfg.nodes.highlightFactor

                    a.transition().duration(100)
                        .attr("r", or)
                        .transition().duration(100)
                        .attr("r", r)
                        .transition().duration(100)
                        .attr("r", or)
                        .transition().duration(100)
                        .attr("r", r)
                }

                a = gLine.select("path#" + i).on("mouseover", null).on("mouseout", null)

                if (!a.empty()) {
                    let ow = cfg.lines.thickness
                    let w = cfg.lines.thickness * cfg.lines.highlightFactor
                    a.transition().duration(100)
                        .attr("stroke-width", ow)
                        .transition().duration(100)
                        .attr("stroke-width", w)
                        .transition().duration(100)
                        .attr("stroke-width", ow)
                        .transition().duration(100)
                        .attr("stroke-width", w)
                }
            }

            function cancelOtherSelected() {
                dataManager.getTree().descendants().filter(d => d.data.isHighlight).forEach(function (d) {
                    cancelSelectOne(d)
                })
            }

            function cancelSelectOne(d) {
                if (!d.data.isHighlight) {
                    return
                }
                delete d.data.isHighlight
                const i = d.data._i
                let a = d3.select("circle#" + i);

                if (!a.empty()) {
                    a.attr("r", cfg.nodes.radius)
                        .on("mouseover", nodeMouseOver)
                        .on("mouseout", nodeMouseOut)
                }

                a = d3.select("path#" + i);
                if (!a.empty()) {
                    a.attr("stroke-width", cfg.lines.thickness)
                        .on("mouseover", lineMouseover)
                        .on("mouseout", lineMouseout)
                }
            }

            function refresh() {
                layouts[status.layout].refresh()
                // if (cfg.contextMenu && window.jQuery && window.jQuery.hasOwnProperty("contextMenu")) {
                //     bindContextMenu()
                // }
                return this
            }

            function moveLayoutToCenterAndRefresh() {
                layouts[status.layout].moveLayoutToCenterAndRefresh()
            }

            function showDefaultLayout() {
                layouts[status.layout].onResume()
            }

            function lineRightClick(d) {
                if (!(cfg.onLineRightClick && cfg.onLineRightClick(d))) {
                }
            }

            function lineLeftClick(d) {
                const bool = d.target.data.isHighlight
                if (!cfg.multipleSelect) cancelOtherSelected()
                if (!(cfg.onLineLeftClick && cfg.onLineLeftClick(d))) {
                    bool ? cancelSelectOne(d.target) : selectOne(d.target)
                }
            }

            function lineMouseover(d) {
                if (!(cfg.onLineMouseover && cfg.onLineMouseover(d))) {
                    mouseover(d.target)
                }
            }

            function lineMouseout(d) {
                if (!(cfg.onLineMouseout && cfg.onLineMouseout(d))) {
                    mouseout(d.target)
                }
            }

            function labelMouseover(d) {
                if (!(cfg.onLabelMouseover && cfg.onLabelMouseover(d))) {
                    mouseover(d)
                }
            }

            function labelMouseout(d) {
                if (!(cfg.onLabelMouseout && cfg.onLabelMouseout(d.target))) {
                    mouseout(d)
                }
            }

            function nodeMouseOver(d) {
                if (!(cfg.onNodeMouseover && cfg.onNodeMouseover(d.target))) {
                    mouseover(d)
                }
            }

            function nodeMouseOut(d) {
                if (!(cfg.onNodeMouseout && cfg.onNodeMouseout(d.target))) {
                    mouseout(d)
                }
            }

            function mouseover(d) {
                if (d.data.isHighlight) {
                    return
                }

                let i = d.data._i

                gNode.select("circle#" + i).attr("r", cfg.nodes.radius * cfg.nodes.mouseOverFactor)
                gLine.select("path#" + i).attr("stroke-width", cfg.lines.thickness * cfg.lines.mouseOverFactor)

                let a = gLabel.select("text#" + i)
                if (!a.empty()) {
                    let originFill = a.attr("fill")

                    a.attr("font-size", cfg.leafLabels.fontSize * cfg.leafLabels.mouseOverFactor)
                        .attr("fill", "blue")
                        .attr("origin-fill", originFill)
                }
            }

            function mouseout(d) {
                if (d.data.isHighlight) {
                    return
                }

                let i = d.data._i

                gNode.select("circle#" + i).attr("r", cfg.nodes.radius)
                gLine.select("path#" + i).attr("stroke-width", cfg.lines.thickness)

                let a = gLabel.select("text#" + i)
                if (!a.empty()) {
                    let originFill = a.attr("origin-fill")
                    a.attr("font-size", cfg.leafLabels.fontSize)
                        .attr("fill", originFill)
                }
            }

            function lineClass(d) {
                const c = ["line"]
                if (d.target.data.isFiltered) {
                    c.push(c.CSS_FILTERED_LINK)
                }
                return c.join(" ")
            }

            function nodeClick(d) {
                if (cfg.onNodeLeftClick) {
                    cfg.onNodeLeftClick(d)
                }
            }

            function leafLabelColor(d) {
                if (d.data.custom && d.data.custom.lc) {
                    return d.data.custom.lc
                } else {
                    return cfg.leafLabels.color
                }
            }

            function nodeSize(d) {
                if (d.data.isHighlight) {
                    return cfg.nodes.radius * cfg.nodes.highlightFactor
                } else if (d.data.custom && d.data.custom.nf) {
                    return d.data.custom.nf * cfg.nodes.radius
                } else {
                    return cfg.nodes.radius
                }
            }

            function nodeColor(d) {
                if (d.data.custom && d.data.custom.nc) {
                    return d.data.custom.nc
                } else {
                    return cfg.nodes.color
                }
            }

            function lineColor(d) {
                d = d.target;
                if (d.data.custom && d.data.custom.lc) {
                    return d.data.custom.lc
                } else {
                    return cfg.lines.color
                }
            }

            function lineSize(d) {
                d = d.target;
                if (d.data.isHighlight) {
                    return cfg.lines.thickness * cfg.lines.highlightFactor
                } else if (d.data.custom && d.data.custom.lf) {
                    return d.data.custom.lf * cfg.lines.thickness
                } else {
                    return cfg.lines.thickness
                }
            }

            function lineDash(d) {
                d = d.target
                if (d.data.isOutGroup) {
                    return cfg.outGroup.dash
                } else if (d.data.custom && d.data.custom.ls) {
                    return d.data.custom.ls
                } else {
                    return null
                }
            }

            function setStartDegree(val) {
                if (status.layout === c.LAYOUT_CIRCULAR) {
                    layouts[status.layout].setStartDegree(val)
                }
            }

            function setExtentDegree(val) {
                if (status.layout === c.LAYOUT_CIRCULAR) {
                    layouts[status.layout].setExtentDegree(val)
                }
            }

            function showLeafLabel(bool) {
                cfg.leafLabels.show = bool
                refresh()
            }

            function showNodes(bool) {
                cfg.nodes.show = bool
                refresh()
            }

            function showAlignToTip(bool) {
                cfg.alignToTips.show = bool
                refresh()
            }

            function showRootLine(bool) {
                cfg.rootLine.show = bool
                refresh()
            }

            function setRootLineLength(num) {
                if (typeof num === "string") {
                    num = +num
                }
                cfg.rootLine.length = num
                refresh()
            }

            function bindContextMenu() {

                $.contextMenu({
                    selector: '.n, .l',
                    items: {
                        openLink: {
                            name: "Open link in new tab",
                            icon: "fa-link",
                        },
                        sep5: "---",
                        updateMutationFrequency: {
                            name: "Update mutation frequency",
                        },
                        sep0: "---",
                        s: {
                            name: "Show clade in new tab",
                            icon: "fa-share-square-o",
                        },
                        sep1: "---",
                        lu: {
                            name: "Ladderize up",
                            icon: "fa-level-up",
                        },
                        ld: {
                            name: "Ladderize down",
                            icon: "fa-level-down",
                        },
                        sep2: "---",
                        c: {
                            name: "Collapse",
                            icon: "fa-compress",
                        },
                        sep3: "---",
                        a: {
                            name: "Annotation",
                            icon: "fa-file-text-o",
                        },
                        ca: {
                            name: "Clear annotations",
                            icon: "fa-trash",
                        },
                        r: {
                            name: "Recolor",
                            icon: "fa-tint",
                        },
                        sep4: "---",
                        refresh: {
                            name: "Refresh",
                            icon: "fa-refresh",
                            callback: refresh,
                        },
                    }
                })

                $.contextMenu({
                    selector: 'use.mark',
                    items: {
                        c: {
                            name: "Recover all collapsed nodes",
                            icon: "fa-expand",
                        },
                        ca: {
                            name: "Clear annotations",
                            icon: "fa-trash",
                        },
                        sep3: "---",
                        r: {
                            name: "Recolor",
                            icon: "fa-tint",
                        },
                        sep4: "---",
                        refresh: {
                            name: "Refresh",
                            icon: "fa-refresh",
                            callback: refresh,
                        },
                    }
                })

                $.contextMenu({
                    selector: `svg`,
                    items: {
                        refresh: {
                            name: "Refresh",
                            callback: moveLayoutToCenterAndRefresh,
                        },
                        ca: {
                            name: "Clear annotations",
                        },
                    }
                })
            }

            //////////////////////////////

            setContainer(options.container)

            Object.assign(this, {
                destroy: destroy,
                refresh: refresh,
                show: showDefaultLayout,
                addBranchScale: addBranchScale,
                switchScaleTo: switchScaleTo,
                switchLayoutTo: switchLayoutTo,
                getScales: () => scales,
                getConfig: () => cfg,

                setRotate: setRotate,
                setStartDegree: setStartDegree,
                setExtentDegree: setExtentDegree,
                showLeafLabel: showLeafLabel,
                showNodes: showNodes,
                showAlignToTip: showAlignToTip,
                showRootLine: showRootLine,
                setRootLineLength: setRootLineLength,
                resize: resize,
            })
        }

        function init() {
            if (options.hasOwnProperty("data")) {
                if (options.data.hasOwnProperty("nwk")) {
                    dataManager.loadFromNwk(
                        options.data.nwk.value,
                        options.data.nwk.parser || null
                    )
                } else if (options.data.hasOwnProperty("obj")) {
                    dataManager.loadFromObject(options.data.obj.value)
                } else if (options.data.hasOwnProperty("json")) {
                    dataManager.loadFromObject(options.data.json.value)
                }

                if (options.data.hasOwnProperty("branchScales")) {
                    for (const branchScale of options.data.branchScales) {
                        layoutManager.addBranchScale(branchScale)
                    }
                }

                if (options.data.hasOwnProperty("colorSchemas")) {
                    for (const colorSchema of options.data.colorSchemas) {
                        dataManager.addColorSchema(colorSchema)
                    }
                }
            }

            if (options.hasOwnProperty("layout")) {
                for (const key of Object.keys(options.layout)) {
                    if (typeof options[key] === 'object' && !key.startsWith("on")) {
                        for (const subKey of Object.keys(options[key])) {
                            layoutManager.getConfig()[key][subKey] = options[key][subKey]
                        }
                    } else {
                        if (layoutManager.getConfig().hasOwnProperty(key)) {
                            layoutManager.getConfig()[key] = options.layout[key]
                        }
                    }
                }
            }

            if (!(options.hasOwnProperty("showDefaultLayout") && options.showDefaultLayout === false)) {
                layoutManager.show()
            }
        }

        const util = new Util()
        const dataManager = new DataManager()
        const layoutManager = new LayoutManager()
        const otherFunctions = {
            clearAnnotations: function () {
                dataManager.clearAnnotationMarks()
                layoutManager.refresh()
            },
            markAnnotation: function (node, annoType, args) {
                dataManager.markAnnotation(node, annoType, args)
                layoutManager.refresh()
            }
        }

        Object.assign(this, dataManager, layoutManager, otherFunctions)

        init()
    }

    d3.evolutree = function (options) {
        return new EvoluTree(options)
    }

    d3.evolutree.colorByLengthSumThreshold = function (threshold) {
        const n = threshold

        return function (tree) {

            const colors = [...d3.schemePaired, ...d3.schemeAccent]
            const markName = "_category"

            // clear mark
            tree.each(function (d) {
                if (d.data.hasOwnProperty(markName)) {
                    delete d.data[markName]
                }
            })

            const categoryNodes = []

            tree.eachBefore(function (d) {
                if (d.data.lengthSum <= n) return
                if (d.ancestors().map(x => x.data[markName]).includes(true)) return
                d.data[markName] = true
                categoryNodes.push(d)
            })

            for (const categoryNode of categoryNodes) {
                const color = colors.shift()
                categoryNode.each(function (d) {
                    if (!d.data.hasOwnProperty("custom")) {
                        d.data.custom = {}
                    }
                    d.data.custom.lc = color
                    d.data.custom.nc = color
                })
            }
        }
    }
}())