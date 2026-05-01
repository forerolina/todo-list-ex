import './style.scss'
import { ensureSession } from './supabase-client'
import {
  addTodo as addTodoRecord,
  clearCompletedTodos as clearCompletedTodoRecords,
  deleteTodo as deleteTodoRecord,
  listTodos,
  toggleTodo as toggleTodoRecord,
} from './todos-api'

const appElement = document.querySelector('#app')

function createTodoItem(text) {
  return {
    id: crypto.randomUUID(),
    text,
    isCompleted: false,
  }
}
let todos = []
let isLoading = true
let errorMessage = ''

function setErrorMessage(message) {
  errorMessage = message
}

async function addTodo(text) {
  const trimmedText = text.trim()
  if (!trimmedText) return false

  setErrorMessage('')
  const optimisticTodo = createTodoItem(trimmedText)
  const previousTodos = [...todos]
  todos = [optimisticTodo, ...todos]
  render()

  try {
    await addTodoRecord(trimmedText)
    todos = await listTodos()
    render()
    return true
  } catch {
    todos = previousTodos
    setErrorMessage('Could not add todo. Please try again.')
    render()
    return false
  }
}

async function toggleTodo(todoId, isCompleted) {
  const targetTodo = todos.find((todo) => todo.id === todoId)
  if (!targetTodo) return

  setErrorMessage('')
  const previousTodos = [...todos]
  todos = todos.map((todo) => {
    if (todo.id !== todoId) return todo
    return { ...todo, isCompleted }
  })
  render()

  try {
    await toggleTodoRecord(todoId, isCompleted)
    todos = await listTodos()
  } catch {
    todos = previousTodos
    setErrorMessage('Could not update todo. Please try again.')
  }

  render()
}

async function deleteTodo(todoId) {
  setErrorMessage('')
  const previousTodos = [...todos]
  todos = todos.filter((todo) => todo.id !== todoId)
  render()

  try {
    await deleteTodoRecord(todoId)
    todos = await listTodos()
    render()
  } catch {
    todos = previousTodos
    setErrorMessage('Could not delete todo. Please try again.')
    render()
  }
}

async function clearCompletedTodos() {
  setErrorMessage('')
  const previousTodos = [...todos]
  todos = todos.filter((todo) => !todo.isCompleted)
  render()

  try {
    await clearCompletedTodoRecords()
  } catch {
    todos = previousTodos
    setErrorMessage('Could not clear completed todos. Please try again.')
    render()
  }
}

async function handleAppClick(event) {
  const buttonElement = event.target.closest('button')
  if (!buttonElement) return

  if (buttonElement.dataset.action === 'clear-completed') {
    await clearCompletedTodos()
    return
  }

  const todoElement = buttonElement.closest('.todo-item')
  if (!todoElement) return

  const todoId = todoElement.dataset.id
  if (!todoId) return

  if (buttonElement.dataset.action === 'delete') await deleteTodo(todoId)
}

async function handleAppChange(event) {
  const inputElement = event.target.closest('input[data-action="toggle"]')
  if (!inputElement) return

  const todoElement = inputElement.closest('.todo-item')
  if (!todoElement) return

  const todoId = todoElement.dataset.id
  if (!todoId) return

  await toggleTodo(todoId, inputElement.checked)
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
  const emptyMessage = isLoading ? 'Loading your todos...' : 'No active todos.'

  appElement.innerHTML = `
    <main class="todo-app cds--css-grid" aria-live="polite">
      <header class="todo-header">
        <h1 class="cds--productive-heading-04">Todo List</h1>
        <p class="cds--body-compact-01">Track your tasks and keep moving.</p>
      </header>
      ${
        errorMessage
          ? `<p class="todo-inline-error" role="status">${errorMessage}</p>`
          : ''
      }

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
            : `<p class="empty-state">${emptyMessage}</p>`
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

  formElement.addEventListener('submit', async (event) => {
    event.preventDefault()
    const hasAddedTodo = await addTodo(inputElement.value)
    if (!hasAddedTodo) return
    inputElement.value = ''
    inputElement.focus()
  })
}

appElement.addEventListener('click', handleAppClick)
appElement.addEventListener('change', handleAppChange)
render()

async function init() {
  try {
    await ensureSession()
    todos = await listTodos()
    setErrorMessage('')
  } catch {
    setErrorMessage('Could not load todos. Check your Supabase configuration.')
  } finally {
    isLoading = false
    render()
  }
}

void init()
