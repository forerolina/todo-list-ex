import './style.css'

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

  if (buttonElement.dataset.action === 'toggle') {
    toggleTodo(todoId)
    return
  }

  if (buttonElement.dataset.action === 'delete') deleteTodo(todoId)
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
      <button
        type="button"
        class="toggle-button"
        data-action="toggle"
        aria-label="${todo.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}"
      >
        ${todo.isCompleted ? '✓' : ''}
      </button>
      <p class="todo-text">${escapedText}</p>
      <button
        type="button"
        class="delete-button"
        data-action="delete"
        aria-label="Delete todo"
      >
        X
      </button>
    </li>
  `
}

function render() {
  const activeTodos = todos.filter((todo) => !todo.isCompleted)
  const completedTodos = todos.filter((todo) => todo.isCompleted)
  const hasTodos = todos.length > 0

  appElement.innerHTML = `
    <main class="todo-app" aria-live="polite">
      <header class="todo-header">
        <h1>Todo List</h1>
        <p>Track your tasks and keep moving.</p>
      </header>

      <form class="todo-form" id="todo-form">
        <label for="todo-input">Add a task</label>
        <div class="todo-form-row">
          <input
            id="todo-input"
            name="todo-input"
            type="text"
            placeholder="Buy groceries"
            autocomplete="off"
            required
          />
          <button type="submit">Add</button>
        </div>
      </form>

      ${
        hasTodos
          ? `
            <section class="todo-list-section" aria-label="Active todos">
              <h2 class="todo-list-title">To do</h2>
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
                      <button type="button" class="secondary-button" data-action="clear-completed">
                        Clear completed
                      </button>
                    </div>
                    <ul class="todo-list">${completedTodos.map((todo) => createTodoMarkup(todo)).join('')}</ul>
                  </section>
                `
                : ''
            }
          `
          : `<p class="empty-state">No todos yet. Add one to get started.</p>`
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
render()
