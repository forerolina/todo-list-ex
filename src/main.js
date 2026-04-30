import './style.css'

const STORAGE_KEY = 'todo-list-items'
const appElement = document.querySelector('#app')

function createTodoItem(text) {
  return {
    id: crypto.randomUUID(),
    text,
    isCompleted: false,
  }
}

function loadTodos() {
  const rawTodos = localStorage.getItem(STORAGE_KEY)
  if (!rawTodos) return []

  try {
    const parsedTodos = JSON.parse(rawTodos)
    if (!Array.isArray(parsedTodos)) return []

    return parsedTodos.filter((todo) => {
      return (
        todo &&
        typeof todo.id === 'string' &&
        typeof todo.text === 'string' &&
        typeof todo.isCompleted === 'boolean'
      )
    })
  } catch {
    return []
  }
}

let todos = loadTodos()

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
}

function addTodo(text) {
  const trimmedText = text.trim()
  if (!trimmedText) return

  todos = [createTodoItem(trimmedText), ...todos]
  saveTodos()
  render()
}

function toggleTodo(todoId) {
  todos = todos.map((todo) => {
    if (todo.id !== todoId) return todo
    return { ...todo, isCompleted: !todo.isCompleted }
  })
  saveTodos()
  render()
}

function deleteTodo(todoId) {
  todos = todos.filter((todo) => todo.id !== todoId)
  saveTodos()
  render()
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
        Delete
      </button>
    </li>
  `
}

function render() {
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
          ? `<ul class="todo-list">${todos.map((todo) => createTodoMarkup(todo)).join('')}</ul>`
          : `<p class="empty-state">No todos yet. Add one to get started.</p>`
      }
    </main>
  `

  const formElement = document.querySelector('#todo-form')
  const inputElement = document.querySelector('#todo-input')
  const listElement = document.querySelector('.todo-list')

  formElement.addEventListener('submit', (event) => {
    event.preventDefault()
    addTodo(inputElement.value)
    inputElement.value = ''
    inputElement.focus()
  })

  if (!listElement) return

  listElement.addEventListener('click', (event) => {
    const buttonElement = event.target.closest('button')
    if (!buttonElement) return

    const todoElement = buttonElement.closest('.todo-item')
    if (!todoElement) return

    const todoId = todoElement.dataset.id
    if (!todoId) return

    if (buttonElement.dataset.action === 'toggle') {
      toggleTodo(todoId)
      return
    }

    if (buttonElement.dataset.action === 'delete') deleteTodo(todoId)
  })
}

render()
