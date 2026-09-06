(function () {
  'use strict';

  function normalizeTitle(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function closeEditor(form, display) {
    if (form && form.parentNode) form.parentNode.removeChild(form);
    if (display) display.hidden = false;
  }

  function openEditor(options) {
    var container = options && options.container;
    var display = options && options.display;
    var onSave = options && options.onSave;
    if (!container || !display || typeof onSave !== 'function') return;

    var activeEditor = container.querySelector('.inline-title-editor');
    if (activeEditor) {
      var activeInput = activeEditor.querySelector('input');
      if (activeInput) activeInput.focus();
      return;
    }

    var currentTitle = normalizeTitle(options.title || display.textContent);
    var form = document.createElement('form');
    var input = document.createElement('input');
    var actions = document.createElement('div');
    var cancel = document.createElement('button');
    var submit = document.createElement('button');
    var status = document.createElement('span');

    form.className = 'inline-title-editor';
    input.type = 'text';
    input.maxLength = 240;
    input.value = currentTitle;
    input.required = true;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Tiêu đề mới');
    actions.className = 'inline-title-editor-actions';
    cancel.type = 'button';
    cancel.className = 'inline-title-cancel';
    cancel.textContent = 'Hủy';
    submit.type = 'submit';
    submit.className = 'inline-title-save';
    submit.textContent = 'Lưu tiêu đề';
    status.className = 'inline-title-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    actions.appendChild(cancel);
    actions.appendChild(submit);
    form.appendChild(input);
    form.appendChild(actions);
    form.appendChild(status);
    display.hidden = true;
    container.insertBefore(form, options.before || display.nextSibling);
    input.focus();
    input.select();

    cancel.addEventListener('click', function () {
      closeEditor(form, display);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var nextTitle = normalizeTitle(input.value);
      if (!nextTitle) {
        status.textContent = 'Tiêu đề không được để trống.';
        status.classList.add('is-error');
        input.focus();
        return;
      }
      if (nextTitle === currentTitle) {
        closeEditor(form, display);
        return;
      }

      input.disabled = true;
      cancel.disabled = true;
      submit.disabled = true;
      status.textContent = 'Đang lưu...';
      status.classList.remove('is-error');

      Promise.resolve(onSave(nextTitle)).then(function () {
        display.textContent = nextTitle;
        closeEditor(form, display);
      }).catch(function () {
        input.disabled = false;
        cancel.disabled = false;
        submit.disabled = false;
        status.textContent = 'Không thể lưu tiêu đề. Vui lòng thử lại.';
        status.classList.add('is-error');
        input.focus();
      });
    });
  }

  window.KHOA_DUOC_TITLE_EDITOR = Object.freeze({
    normalizeTitle: normalizeTitle,
    open: openEditor
  });
}());
