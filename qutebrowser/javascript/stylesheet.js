/**
 * Copyright 2017-2019 Florian Bruhin (The Compiler) <mail@qutebrowser.org>
 * Copyright 2017 Ulrik de Muelenaere <ulrikdem@gmail.com>
 *
 * This file is part of qutebrowser.
 *
 * qutebrowser is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * qutebrowser is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with qutebrowser.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

window._qutebrowser.stylesheet = (function() {
    if (window._qutebrowser.stylesheet) {
        return window._qutebrowser.stylesheet;
    }

    const funcs = {};

    const xhtml_ns = "http://www.w3.org/1999/xhtml";
    const svg_ns = "http://www.w3.org/2000/svg";

    let root_elem;
    let root_key;
    let style_elem;
    let css_content = "";

    function is_stylesheet_applied(css) {
        return style_elem && style_elem.textContent === css;
    }

    function ensure_stylesheet_loaded() {
        if (!document.documentElement) {
            throw new Error(
                "ensure_stylesheet_loaded called before DOM was available"
            );
        }

        if (style_elem) {
            style_elem.textContent = css_content;
        } else {
            style_elem = create_style(css_content);
        }

        if (style_elem !== root_elem.lastChild) {
            root_elem.appendChild(style_elem);
        }
    }

    function ensure_root_present() {
        let waiting_interval;
        function is_root_present() {
            return document && document.documentElement;
        }
        return new Promise((resolve) => {
            if (is_root_present()) {
                root_elem = document.documentElement;
                resolve(document.documentElement);
            } else {
                waiting_interval = setInterval(() => {
                    if (!is_root_present()) {
                        return;
                    }
                    clearInterval(waiting_interval);
                    root_elem = document.documentElement;
                    resolve(document.documentElement);
                }, 100);
            }
        });
    }

    function wait_for_new_root() {
        function is_new_root() {
            return (
                document.documentElement &&
                document.documentElement.getAttribute("__qb_key") !==
                    root_key &&
                check_style(document.documentElement)
            );
        }
        function setup_new_root(new_root_elem) {
            root_elem = new_root_elem;
            root_key = new Date().getTime();
            root_elem.setAttribute("__qb_key", root_key);
            // style_elem would refer to a node in the old page's dom
            style_elem = null;
            return root_elem;
        }
        return new Promise((resolve) => {
            if (is_new_root()) {
                resolve(setup_new_root(document.documentElement));
            } else {
                waiting_interval = setInterval(() => {
                    if (!is_new_root()) {
                      return;
                    }
                    clearInterval(waiting_interval);
                    resolve(setup_new_root(document.documentElement));
                }, 100);
            }
        });
    }

    function create_style() {
        let ns = xhtml_ns;
        if (
            document.documentElement &&
            document.documentElement.namespaceURI === svg_ns
        ) {
            ns = svg_ns;
        }
        style_elem = document.createElementNS(ns, "style");
        style_elem.textContent = css_content;
        return style_elem;
    }

    // We should only inject the stylesheet if the document already has style
    // information associated with it. Otherwise we wait until the browser
    // rewrites it to an XHTML document showing the document tree. As a
    // starting point for exploring the relevant code in Chromium, see
    // https://github.com/qt/qtwebengine-chromium/blob/cfe8c60/chromium/third_party/WebKit/Source/core/xml/parser/XMLDocumentParser.cpp#L1539-L1540
    function check_style(node) {
        const stylesheet =
            node.nodeType === Node.PROCESSING_INSTRUCTION_NODE &&
            node.target === "xml-stylesheet" &&
            node.parentNode === document;
        const known_ns =
            node.nodeType === Node.ELEMENT_NODE &&
            (node.namespaceURI === xhtml_ns || node.namespaceURI === svg_ns);
        return stylesheet || known_ns;
    }

    function set_css(css) {
        ensure_root_present().then(() => {
            if (is_stylesheet_applied(css)) {
                return;
            }
            css_content = css;

            ensure_stylesheet_loaded();
            // Propagate the new CSS to all child frames.
            // FIXME:qtwebengine This does not work for cross-origin frames.
            for (let i = 0; i < window.frames.length; ++i) {
                const frame = window.frames[i];
                if (frame._qutebrowser && frame._qutebrowser.stylesheet) {
                    frame._qutebrowser.stylesheet.set_css(css);
                }
            }
        });
    }

    function set_new_page_css(css) {
        wait_for_new_root().then(() => {
            set_css(css);
        });
    }

    // exports
    funcs.set_css = set_css;
    funcs.set_new_page_css = set_new_page_css;

    return funcs;
})();
