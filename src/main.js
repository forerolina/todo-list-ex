import './style.scss'

const appElement = document.querySelector('#app')

function createTodoItem(text) {
  return {
    id: crypto.randomUUID(),
    text,
    isCompleted: false,
  }
}
let todos = []

function addTodo(text) {
  const trimmedText = text.trim()
  if (!trimmedText) return

  todos = [createTodoItem(trimmedText), ...todos]
  render()
}

function toggleTodo(todoId) {
  todos = todos.map((todo) => {
    if (todo.id !== todoId) return todo
    return { ...todo, isCompleted: !todo.isCompleted }
  })
  render()
}

function deleteTodo(todoId) {
  todos = todos.filter((todo) => todo.id !== todoId)
  render()
}

function clearCompletedTodos() {
  todos = todos.filter((todo) => !todo.isCompleted)
  render()
}

function handleAppClick(event) {
  const buttonElement = event.target.closest('button')
  if (!buttonElement) return

  if (buttonElement.dataset.action === 'clear-completed') {
    clearCompletedTodos()
    return
  }

  const todoElement = buttonElement.closest('.todo-item')
  if (!todoElement) return

  const todoId = todoElement.dataset.id
  if (!todoId) return

  if (buttonElement.dataset.action === 'delete') deleteTodo(todoId)
}

function handleAppChange(event) {
  const inputElement = event.target.closest('input[data-action="toggle"]')
  if (!inputElement) return

  const todoElement = inputElement.closest('.todo-item')
  if (!todoElement) return

  const todoId = todoElement.dataset.id
  if (!todoId) return

  toggleTodo(todoId)
}

function createTodoMarkup(todo) {
  const escapedText = todo.text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

  return `
    <li class="todo-item ${todo.isCompleted ? 'is-completed' : ''}" data-id="${todo.id}">
      <input
        type="checkbox"
        class="toggle-checkbox"
        data-action="toggle"
        aria-label="${todo.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}"
        ${todo.isCompleted ? 'checked' : ''}
      />
      <p class="todo-text">${escapedText}</p>
      <button
        type="button"
        class="delete-button cds--btn cds--btn--ghost"
        data-action="delete"
        aria-label="Delete todo"
      >
        Delete
      </button>
    </li>
  `
}

function render() {
  const activeTodos = todos.filter((todo) => !todo.isCompleted)
  const completedTodos = todos.filter((todo) => todo.isCompleted)

  appElement.innerHTML = `
    <main class="todo-app cds--css-grid" aria-live="polite">
      <header class="todo-header">
        <h1 class="cds--productive-heading-04">Todo List</h1>
        <p class="cds--body-compact-01">Track your tasks and keep moving.</p>
      </header>

      <form class="todo-form cds--form" id="todo-form">
        <div class="cds--form-item">
          <label class="cds--label" for="todo-input">Add a task</label>
        </div>
        <div class="todo-form-row">
          <div class="cds--form-item todo-form-input-item">
            <input
              class="cds--text-input"
              id="todo-input"
              name="todo-input"
              type="text"
              placeholder="Buy groceries"
              autocomplete="off"
              required
            />
          </div>
          <button
            class="cds--btn cds--btn--primary cds--btn--icon-only todo-add-button"
            type="submit"
            aria-label="Add task"
          >
            <span class="cds--btn__icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                <path d="M17 15V8h-2v7H8v2h7v7h2v-7h7v-2z" />
              </svg>
            </span>
          </button>
        </div>
      </form>

      <section class="todo-list-section" aria-label="Active todos">
        ${
          activeTodos.length > 0
            ? `<ul class="todo-list">${activeTodos.map((todo) => createTodoMarkup(todo)).join('')}</ul>`
            : `<p class="empty-state">No active todos.</p>`
        }
      </section>

      ${
        completedTodos.length > 0
          ? `
      <section class="todo-list-section" aria-label="Completed todos">
        <div class="todo-list-section-header">
          <h2 class="todo-list-title">Completed</h2>
          <button
            type="button"
            class="secondary-button cds--btn cds--btn--tertiary"
            data-action="clear-completed"
          >
            Clear all
          </button>
        </div>
        <ul class="todo-list">${completedTodos.map((todo) => createTodoMarkup(todo)).join('')}</ul>
      </section>
      `
          : ''
      }
    </main>
  `

  const formElement = document.querySelector('#todo-form')
  const inputElement = document.querySelector('#todo-input')

  formElement.addEventListener('submit', (event) => {
    event.preventDefault()
    addTodo(inputElement.value)
    inputElement.value = ''
    inputElement.focus()
  })
}

appElement.addEventListener('click', handleAppClick)
appElement.addEventListener('change', handleAppChange)
render()
