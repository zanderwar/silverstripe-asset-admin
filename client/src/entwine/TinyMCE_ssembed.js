/* global tinymce */

import jQuery from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import { ApolloProvider } from 'react-apollo';

/**
 * Embed shortcodes are split into an outer <div> element and an inner <img>
 * placeholder based on the thumbnail url provided by the oembed shortcode provider.
 */
(() => {
  const ssembed = {
    init: (editor) => {
      editor.addButton('ssembed', {
        icon: 'media',
        title: 'Insert Embedded content',
        cmd: 'ssembed',
      });
      editor.addMenuItem('ssembed', {
        icon: 'media',
        text: 'Insert Embedded content',
        cmd: 'ssembed',
      });

      editor.addCommand('ssembed', () => {
        // See HtmlEditorField.js
        jQuery(`#${editor.id}`).entwine('ss').openEmbedDialog();
      });

      // Replace the tinymce default media commands with the ssembed command
      editor.on('BeforeExecCommand', (e) => {
        const cmd = e.command;
        const ui = e.ui;
        const val = e.value;
        if (cmd === 'mceAdvMedia' || cmd === 'mceAdvMedia') {
          e.preventDefault();
          editor.execCommand('ssembed', ui, val);
        }
      });

      editor.on('SaveContent', (o) => {
        const content = jQuery(o.content);
        const attrsFn = (attrs) => (
          Object.entries(attrs)
            .map(([name, value]) => ((value)
              ? `${name}="${value}"`
              : null
            ))
            .filter((attr) => attr !== null)
            .join(' ')
        );

        // Transform [embed] shortcodes
        const filter = 'div[data-shortcode=\'embed\']';
        content.find(filter)
          .add(content.filter(filter))
          .each(function replaceWithShortCode() {
            // Note: embed <div> contains placeholder <img>, and potentially caption <p>
            const embed = jQuery(this);
            const placeholder = embed.find('.placeholder');
            const caption = embed.find('.caption').text();
            const width = parseInt(placeholder.attr('width'), 10);
            const height = parseInt(placeholder.attr('height'), 10);
            const url = embed.data('url');
            const attrs = {
              url,
              thumbnail: placeholder.prop('src'),
              class: embed.prop('class'),
              width: isNaN(width) ? null : width,
              height: isNaN(height) ? null : height,
              caption
            };
            const shortCode = `[embed ${attrsFn(attrs)}]${url}[/embed]`;
            embed.replaceWith(shortCode);
          });

        // Insert outerHTML in order to retain all nodes incl. <script>
        // tags which would've been filtered out with jQuery.html().
        // Note that <script> tags might be sanitized separately based on editor config.
        // eslint-disable-next-line no-param-reassign
        o.content = '';
        content.each(function appendToContent() {
          if (this.outerHTML !== undefined) {
            // eslint-disable-next-line no-param-reassign
            o.content += this.outerHTML;
          }
        });
      });
      editor.on('BeforeSetContent', (o) => {
        let content = o.content;
        const attrFromStrFn = (str) => (
          str
          // Split on all attributes, quoted or not
            .match(/([^\s\/'"=,]+)\s*=\s*(('([^']+)')|("([^"]+)")|([^\s,\]]+))/g)
            .reduce((coll, val) => {
              const match
                = val.match(/^([^\s\/'"=,]+)\s*=\s*(?:(?:'([^']+)')|(?:"([^"]+)")|(?:[^\s,\]]+))$/);
              const key = match[1];
              const value = match[2] || match[3] || match[4]; // single, double, or unquoted match
              return Object.assign({}, coll, { [key]: value });
            }, {})
        );

        // Transform [embed] tag
        const shortTagEmbegRegex = /\[embed(.*?)](.+?)\[\/\s*embed\s*]/gi;
        let matches = shortTagEmbegRegex.exec(content);
        while (matches) {
          const data = attrFromStrFn(matches[1]);

          // Add base div
          const base = jQuery('<div/>')
            .data('url', data.url || matches[2])
            .data('shortcode', 'embed')
            .addClass(data.class)
            .addClass('ss-htmleditorfield-file embed');

          // Add placeholder
          const placeholder = jQuery('<img />')
            .attr('src', data.thumbnail)
            .addClass('placeholder');

          // Set dimensions
          if (data.width && data.height) {
            base.width(data.width);
            base.height(data.height);
            placeholder.attr('width', data.width);
            placeholder.attr('height', data.height);
          }

          base.appendChild(placeholder);

          // Add caption p tag
          if (data.caption) {
            const caption = jQuery('<p />')
              .addClass('caption')
              .text(data.caption);
            base.appendChild(caption);
          }

          // Inject into code
          content = content.replace(matches[0], base.html());

          // Search for next match
          matches = shortTagEmbegRegex.exec(content);
        }

        // eslint-disable-next-line no-param-reassign
        o.content = content;
      });
    },
  };

  tinymce.PluginManager.add('ssembed', (editor) => ssembed.init(editor));
})();

jQuery.entwine('ss', ($) => {
  $('#insert-embed-react__dialog-wrapper').entwine({
    Element: null,

    Data: {},

    onunmatch() {
      // solves errors given by ReactDOM "no matched root found" error.
      this._clearModal();
    },

    _clearModal() {
      ReactDOM.unmountComponentAtNode(this[0]);
      // this.empty();
    },

    open() {
      this._renderModal(true);
    },

    close() {
      this.setData({});
      this._renderModal(false);
    },

    /**
     * Renders the react modal component
     *
     * @param {boolean} show
     * @private
     */
    _renderModal(show) {
      const handleHide = () => this.close();
      const handleInsert = (...args) => this._handleInsert(...args);
      const handleCreate = (...args) => this._handleCreate(...args);
      const handleLoadingError = (...args) => this._handleLoadingError(...args);
      const store = window.ss.store;
      const client = window.ss.apolloClient;
      const attrs = this.getOriginalAttributes();
      const InsertEmbedModal = window.InsertEmbedModal.default;

      // @todo attrs doesn't seem to populate Url when creating a new oembed
      // something to look at?
      throw new Error('see above');
      

      if (!InsertEmbedModal) {
        throw new Error('Invalid Insert embed modal component found');
      }

      // create/update the react component
      ReactDOM.render(
        <ApolloProvider store={store} client={client}>
          <InsertEmbedModal
            show={show}
            onCreate={handleCreate}
            onInsert={handleInsert}
            onHide={handleHide}
            onLoadingError={handleLoadingError}
            bodyClassName="modal__dialog"
            className="insert-embed-react__dialog-wrapper"
            fileAttributes={attrs}
          />
        </ApolloProvider>,
        this[0]
      );
    },

    _handleLoadingError() {
      this.setData({});
      this.open();
    },

    /**
     * Handles inserting the selected file in the modal
     *
     * @param {object} data
     * @param {object} file
     * @returns {Promise}
     * @private
     */
    _handleInsert(data) {
      const oldData = this.getData();
      this.setData(Object.assign({ Url: oldData.Url }, data));

      this.insertRemote();
      this.close();
    },

    _handleCreate(data) {
      this.setData(Object.assign({}, this.getData(), data));
      this.open();
    },

    /**
     * Find the selected node and get attributes associated to attach the data to the form
     *
     * @returns {object}
     */
    getOriginalAttributes() {
      const $field = this.getElement();
      if (!$field) {
        return {};
      }

      const node = $($field.getEditor().getSelectedNode());
      if (!node.length) {
        return {};
      }
      const data = this.getData();

      // Find root embed shortcode
      const element = node.closest('[data-shortcode=\'embed\']');
      if (!element.length) {
        return {};
      }
      const image = element.children('.placeholder');
      const caption = element.children('.caption').text();
      const width = parseInt(image.width(), 10);
      const height = parseInt(image.height(), 10);

      return {
        Url: element.data('url') || data.Url,
        CaptionText: caption,
        PreviewUrl: image.attr('src'),
        Width: isNaN(width) ? null : width,
        Height: isNaN(height) ? null : height,
        Placement: this.findPosition(element.prop('class')),
      };
    },

    /**
     * Calculate placement from css class
     */
    findPosition(cssClass) {
      const alignments = [
        'leftAlone',
        'center',
        'rightAlone',
        'left',
        'right'
      ];
      return alignments.find((alignment) => {
        const expr = new RegExp(`\\b${alignment}\\b`);
        return expr.test(cssClass);
      });
    },

    insertRemote() {
      const $field = this.getElement();
      if (!$field) {
        return false;
      }
      const editor = $field.getEditor();
      if (!editor) {
        return false;
      }

      const data = this.getData();

      // Add base div
      const base = jQuery('<div/>')
        .data('url', data.Url)
        .data('shortcode', 'embed')
        .addClass(data.Placement)
        .addClass('ss-htmleditorfield-file embed');

      // Add placeholder image
      const placeholder = jQuery('<img />')
        .attr('src', data.PreviewUrl)
        .addClass('placeholder');

      // Set dimensions
      if (data.Width && data.Height) {
        base.width(data.Width);
        base.height(data.Height);
        placeholder.attr('width', data.Width);
        placeholder.attr('height', data.Height);
      }

      // Add to base
      base.appendChild(placeholder);

      // Add caption p tag
      if (data.CaptionText) {
        const caption = jQuery('<p />')
          .addClass('caption')
          .text(data.CaptionText);
        base.appendChild(caption);
      }

      // Find best place to put this embed
      const node = $(editor.getSelectedNode());
      let replacee = $(null);
      if (node.length) {
        // Find find closest existing embed
        replacee = node.closest('[data-shortcode=\'embed\']');

        // Fail over to closest image
        if (replacee.length === 0) {
          replacee = node.closest('img');
        }

        // Replace existing node
        if (replacee.length === 0) {
          replacee = node;
        }
      }

      // Inject
      if (replacee.length) {
        replacee.replaceWith(base);
      } else {
        // Otherwise insert the whole HTML content
        editor.repaint();
        editor.insertContent($('<div />').append(base).html(), { skip_undo: 1 });
      }

      editor.addUndo();
      editor.repaint();

      return true;
    },
  });
});
