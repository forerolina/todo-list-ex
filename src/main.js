import './style.scss'
import {
  ensureSession,
  getSession,
  hasAuthCallbackInUrl,
  linkAnonymousToEmailPassword,
  onAuthStateChange,
  requestPasswordReset,
  signInWithPassword,
  signOut as signOutUser,
  signUpWithEmail,
  updateAccountPassword,
} from './supabase-client'
import {
  addTodo as addTodoRecord,
  claimAnonymousTodos,
  clearCompletedTodos as clearCompletedTodoRecords,
  deleteTodo as deleteTodoRecord,
  listTodos,
  normalizePriority,
  toggleTodo as toggleTodoRecord,
} from './todos-api'

const appElement = document.querySelector('#app')

function createTodoItem(text, priority = 'medium') {
  return {
    id: crypto.randomUUID(),
    text,
    isCompleted: false,
    priority: normalizePriority(priority),
    createdAt: new Date().toISOString(),
  }
}

let todos = []
let isLoading = true
let errorMessage = ''
let authMessage = ''
let currentSession = null
let isAuthSubmitting = false
let authModalMode = null
const pendingAnonymousUserKey = 'todo-list:pending-anonymous-user-id'

let todoIdPendingCheckAnimation = null

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

function commitAppMarkup(html) {
  // Always assign synchronously: startViewTransition can run this callback after
  // `commitAppMarkup` returns, so `render` would query the DOM before `#todo-form` exists.
  appElement.innerHTML = html
}

function setErrorMessage(message) {
  errorMessage = message
}

function setAuthMessage(message) {
  authMessage = message
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function authInlineNotificationMarkup(message) {
  const text = escapeHtml(message)
  return `
    <div
      class="auth-panel-notice cds--inline-notification cds--inline-notification--low-contrast cds--inline-notification--success cds--inline-notification--hide-close-button"
      role="status"
    >
      <div class="cds--inline-notification__details">
        <svg
          class="cds--inline-notification__icon"
          width="20"
          height="20"
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM14,21.5908l-5-5L10.5906,15,14,18.4092,21.41,11l1.5957,1.5859Z"
          />
        </svg>
        <div class="cds--inline-notification__text-wrapper">
          <p class="cds--inline-notification__subtitle">${text}</p>
        </div>
      </div>
    </div>
  `
}

function getCurrentUser() {
  return currentSession?.user ?? null
}

function savePendingAnonymousUserId(userId) {
  window.localStorage.setItem(pendingAnonymousUserKey, userId)
}

function readPendingAnonymousUserId() {
  return window.localStorage.getItem(pendingAnonymousUserKey)
}

function clearPendingAnonymousUserId() {
  window.localStorage.removeItem(pendingAnonymousUserKey)
}

function clearAuthHashFromUrl() {
  if (!window.location.hash) return
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  )
}

function isAnonymousUser(user) {
  return Boolean(user?.is_anonymous)
}

function getAccountLabel() {
  const currentUser = getCurrentUser()
  if (!currentUser || isAnonymousUser(currentUser)) return 'Guest session'
  return `Signed in as ${escapeHtml(currentUser.email ?? 'account user')}`
}

async function addTodo(text, priorityRaw) {
  const trimmedText = text.trim()
  if (!trimmedText) return false

  const priority = normalizePriority(priorityRaw)
  setErrorMessage('')
  const optimisticTodo = createTodoItem(trimmedText, priority)
  const previousTodos = [...todos]
  todos = [optimisticTodo, ...todos]
  render()

  try {
    await addTodoRecord(trimmedText, priority)
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
  if (isCompleted && !prefersReducedMotion()) todoIdPendingCheckAnimation = todoId
  else todoIdPendingCheckAnimation = null

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

  todoIdPendingCheckAnimation = null
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

function priorityOptionsMarkup(selectedRaw) {
  const emptySelected =
    selectedRaw === '' || selectedRaw === null || selectedRaw === undefined
  const p = emptySelected ? null : normalizePriority(selectedRaw)
  return `
    <option value="" ${emptySelected ? 'selected' : ''}>Select priority</option>
    <option value="high" ${p === 'high' ? 'selected' : ''}>High</option>
    <option value="medium" ${p === 'medium' ? 'selected' : ''}>Medium</option>
    <option value="low" ${p === 'low' ? 'selected' : ''}>Low</option>
  `
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function sortTodosByPriorityHighFirst(list) {
  return [...list].sort((a, b) => {
    const pa = PRIORITY_ORDER[normalizePriority(a.priority)]
    const pb = PRIORITY_ORDER[normalizePriority(b.priority)]
    if (pa !== pb) return pa - pb
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0
    if (ta !== tb) return tb - ta
    return String(a.id).localeCompare(String(b.id))
  })
}

function priorityDisplayLabel(priorityRaw) {
  const p = normalizePriority(priorityRaw)
  if (p === 'high') return 'High'
  if (p === 'low') return 'Low'
  return 'Medium'
}

function priorityCarbonTagKind(priorityRaw) {
  const p = normalizePriority(priorityRaw)
  if (p === 'high') return 'red'
  if (p === 'low') return 'cool-gray'
  return 'blue'
}

function createTodoMarkup(todo) {
  const escapedText = escapeHtml(todo.text)
  const checkAnimClass =
    todoIdPendingCheckAnimation === todo.id && todo.isCompleted ? ' is-check-animating' : ''
  const p = normalizePriority(todo.priority)
  const priorityLabel = priorityDisplayLabel(p)
  const priorityLabelEscaped = escapeHtml(priorityLabel)
  const priorityAria = escapeHtml(`Priority: ${priorityLabel}`)
  const tagKind = priorityCarbonTagKind(p)

  return `
    <li
      class="todo-item ${todo.isCompleted ? 'is-completed' : ''}${checkAnimClass}"
      data-id="${todo.id}"
      data-priority="${p}"
      style="view-transition-name: todo-${todo.id}"
    >
      <input
        type="checkbox"
        class="toggle-checkbox"
        data-action="toggle"
        aria-label="${todo.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}"
        ${todo.isCompleted ? 'checked' : ''}
      />
      <p class="todo-text">${escapedText}</p>
      <span
        class="cds--tag cds--layout--size-sm cds--tag--${tagKind}"
        aria-label="${priorityAria}"
      >
        <span class="cds--tag__label">${priorityLabelEscaped}</span>
      </span>
      <button
        type="button"
        class="delete-button cds--btn cds--btn--ghost cds--btn--icon-only"
        data-action="delete"
        aria-label="Delete todo"
      >
        <span class="cds--btn__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path d="M24 9.4L22.6 8 16 14.6 9.4 8 8 9.4 14.6 16 8 22.6 9.4 24 16 17.4 22.6 24 24 22.6 17.4 16 24 9.4z" />
          </svg>
        </span>
      </button>
    </li>
  `
}

function render() {
  const activeTodos = sortTodosByPriorityHighFirst(todos.filter((todo) => !todo.isCompleted))
  const completedTodos = sortTodosByPriorityHighFirst(todos.filter((todo) => todo.isCompleted))
  const emptyMessage = isLoading ? 'Loading your todos...' : 'No active todos.'
  const currentUser = getCurrentUser()
  const isEmailAccountUser = Boolean(currentUser && !isAnonymousUser(currentUser))
  const showPasswordForms = !isEmailAccountUser
  const isSignInModal = authModalMode === 'sign-in'
  const isSignUpModal = authModalMode === 'sign-up'
  const isForgotPasswordModal = authModalMode === 'forgot-password'
  const isChangePasswordModal = authModalMode === 'change-password'
  const isResetPasswordModal = authModalMode === 'reset-password'
  const isAuthModalOpen = Boolean(authModalMode)
  const authModalTitle = isSignInModal
    ? 'Login'
    : isSignUpModal
      ? 'Sign up'
      : isForgotPasswordModal
        ? 'Reset password'
        : isChangePasswordModal
          ? 'Change password'
          : isResetPasswordModal
            ? 'Set new password'
            : ''
  const authSubmitLabel = isAuthSubmitting ? 'Working...' : 'Continue'
  const authDisabledAttribute = isAuthSubmitting ? 'disabled' : ''
  const signOutDisabledAttribute = isAuthSubmitting ? 'disabled' : ''
  document.body.classList.toggle('is-modal-open', isAuthModalOpen)

  commitAppMarkup(`
    <main class="todo-app cds--css-grid" aria-live="polite">
      <header class="todo-header">
        <div class="todo-header-top-row">
          <div class="todo-header-title-group">
            <h1 class="cds--productive-heading-04">Todo List</h1>
            <p class="cds--body-compact-01">Track your tasks and keep moving.</p>
          </div>
          <div class="todo-auth-controls">
            <p class="todo-account-status" aria-label="Current account status">${getAccountLabel()}</p>
            ${
              showPasswordForms
                ? `
          <div class="auth-actions">
            <button
              type="button"
              class="cds--btn cds--btn--primary"
              data-action="open-sign-in-modal"
              ${authDisabledAttribute}
            >
              Login
            </button>
            <button
              type="button"
              class="cds--btn cds--btn--secondary"
              data-action="open-sign-up-modal"
              ${authDisabledAttribute}
            >
              Sign up
            </button>
          </div>
          `
                : ''
            }
          </div>
        </div>
      </header>
      <section class="auth-panel" aria-label="Authentication"><div class="auth-panel-header">${
        isEmailAccountUser
          ? `<div class="auth-panel-actions">
            <button
              type="button"
              class="secondary-button cds--btn cds--btn--ghost"
              id="change-password-button"
              data-action="open-change-password-modal"
              ${signOutDisabledAttribute}
            >
              Change password
            </button>
            <button
              type="button"
              class="secondary-button cds--btn cds--btn--tertiary"
              id="sign-out-button"
              ${signOutDisabledAttribute}
            >
              Sign out
            </button>
          </div>`
          : ''
      }</div>${
        authMessage ? authInlineNotificationMarkup(authMessage) : ''
      }</section>
      ${
        isAuthModalOpen
          ? `
      <div class="auth-modal-overlay" data-action="close-auth-modal">
        <section class="auth-modal" role="dialog" aria-modal="true" aria-label="${authModalTitle}">
          <header class="auth-modal-header">
            <h2 class="todo-list-title">${authModalTitle}</h2>
            <button
              type="button"
              class="secondary-button cds--btn cds--btn--ghost"
              data-action="close-auth-modal"
              ${authDisabledAttribute}
            >
              Close
            </button>
          </header>
          ${
            isSignInModal
              ? `
          <form class="cds--form auth-form auth-modal-form" id="sign-in-form">
            <div class="auth-form-column">
              <div class="cds--form-item">
                <label class="cds--label" for="sign-in-email">Email</label>
                <input class="cds--text-input" id="sign-in-email" name="email" type="email" required ${authDisabledAttribute} />
              </div>
              <div class="cds--form-item">
                <label class="cds--label" for="sign-in-password">Password</label>
                <input class="cds--text-input" id="sign-in-password" name="password" type="password" minlength="8" required ${authDisabledAttribute} />
              </div>
              <button class="cds--btn cds--btn--primary" type="submit" ${authDisabledAttribute}>${authSubmitLabel}</button>
              <p class="auth-form-footer">
                <button type="button" class="auth-link-button cds--btn cds--btn--ghost" data-action="open-forgot-password-modal" ${authDisabledAttribute}>
                  Forgot password?
                </button>
              </p>
            </div>
          </form>
          `
              : ''
          }
          ${
            isSignUpModal
              ? `
          <form class="cds--form auth-form auth-modal-form" id="sign-up-form">
            <div class="auth-form-column">
              <div class="cds--form-item">
                <label class="cds--label" for="sign-up-email">Email</label>
                <input class="cds--text-input" id="sign-up-email" name="email" type="email" required ${authDisabledAttribute} />
              </div>
              <div class="cds--form-item">
                <label class="cds--label" for="sign-up-password">Password</label>
                <input class="cds--text-input" id="sign-up-password" name="password" type="password" minlength="8" required ${authDisabledAttribute} />
              </div>
              <button class="cds--btn cds--btn--secondary" type="submit" ${authDisabledAttribute}>Create account</button>
            </div>
          </form>
          `
              : ''
          }
          ${
            isForgotPasswordModal
              ? `
          <form class="cds--form auth-form auth-modal-form" id="forgot-password-form">
            <div class="auth-form-column">
              <p class="auth-modal-lead">We will email you a link to choose a new password.</p>
              <div class="cds--form-item">
                <label class="cds--label" for="forgot-password-email">Email</label>
                <input class="cds--text-input" id="forgot-password-email" name="email" type="email" required ${authDisabledAttribute} />
              </div>
              <button class="cds--btn cds--btn--primary" type="submit" ${authDisabledAttribute}>Send reset link</button>
              <p class="auth-form-footer">
                <button type="button" class="auth-link-button cds--btn cds--btn--ghost" data-action="open-sign-in-modal" ${authDisabledAttribute}>
                  Back to login
                </button>
              </p>
            </div>
          </form>
          `
              : ''
          }
          ${
            isChangePasswordModal
              ? `
          <form class="cds--form auth-form auth-modal-form" id="change-password-form">
            <div class="auth-form-column">
              <div class="cds--form-item">
                <label class="cds--label" for="change-password-new">New password</label>
                <input class="cds--text-input" id="change-password-new" name="password" type="password" minlength="8" required autocomplete="new-password" ${authDisabledAttribute} />
              </div>
              <div class="cds--form-item">
                <label class="cds--label" for="change-password-confirm">Confirm new password</label>
                <input class="cds--text-input" id="change-password-confirm" name="password-confirm" type="password" minlength="8" required autocomplete="new-password" ${authDisabledAttribute} />
              </div>
              <button class="cds--btn cds--btn--primary" type="submit" ${authDisabledAttribute}>Update password</button>
            </div>
          </form>
          `
              : ''
          }
          ${
            isResetPasswordModal
              ? `
          <form class="cds--form auth-form auth-modal-form" id="reset-password-form">
            <div class="auth-form-column">
              <p class="auth-modal-lead">Choose a new password for your account.</p>
              <div class="cds--form-item">
                <label class="cds--label" for="reset-password-new">New password</label>
                <input class="cds--text-input" id="reset-password-new" name="password" type="password" minlength="8" required autocomplete="new-password" ${authDisabledAttribute} />
              </div>
              <div class="cds--form-item">
                <label class="cds--label" for="reset-password-confirm">Confirm new password</label>
                <input class="cds--text-input" id="reset-password-confirm" name="password-confirm" type="password" minlength="8" required autocomplete="new-password" ${authDisabledAttribute} />
              </div>
              <button class="cds--btn cds--btn--primary" type="submit" ${authDisabledAttribute}>Save new password</button>
            </div>
          </form>
          `
              : ''
          }
        </section>
      </div>
      `
          : ''
      }
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
          <div class="cds--form-item todo-form-priority-inline">
            <select
              id="todo-priority"
              name="todo-priority"
              class="cds--text-input todo-form-priority-select"
              aria-label="Priority"
            >
              ${priorityOptionsMarkup('')}
            </select>
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
  `)

  const formElement = document.querySelector('#todo-form')
  const inputElement = document.querySelector('#todo-input')
  const signUpFormElement = document.querySelector('#sign-up-form')
  const signInFormElement = document.querySelector('#sign-in-form')
  const forgotPasswordFormElement = document.querySelector('#forgot-password-form')
  const changePasswordFormElement = document.querySelector('#change-password-form')
  const resetPasswordFormElement = document.querySelector('#reset-password-form')
  const signOutButtonElement = document.querySelector('#sign-out-button')

  const priorityFormSelect = /** @type {HTMLSelectElement | null} */ (
    document.querySelector('#todo-priority')
  )

  formElement.addEventListener('submit', async (event) => {
    event.preventDefault()
    const hasAddedTodo = await addTodo(inputElement.value, priorityFormSelect?.value)
    if (!hasAddedTodo) return
    inputElement.value = ''
    if (priorityFormSelect) priorityFormSelect.value = ''
    inputElement.focus()
  })

  signUpFormElement?.addEventListener('submit', handleSignUpSubmit)
  signInFormElement?.addEventListener('submit', handleSignInSubmit)
  forgotPasswordFormElement?.addEventListener('submit', handleForgotPasswordSubmit)
  changePasswordFormElement?.addEventListener('submit', handleChangePasswordSubmit)
  resetPasswordFormElement?.addEventListener('submit', handleResetPasswordSubmit)
  signOutButtonElement?.addEventListener('click', handleSignOutClick)
}

appElement.addEventListener('click', handleAppClick)
appElement.addEventListener('change', handleAppChange)
render()

/** One sync at a time so INITIAL_SESSION + init() cannot interleave and skip `finally`. */
let syncSessionChain = Promise.resolve()

function enqueueSyncSession(session) {
  const pending = syncSessionChain.then(() => syncSession(session))
  syncSessionChain = pending.catch(() => {})
  return pending
}

async function syncSession(session) {
  const previousSession = currentSession

  try {
    let activeSession = session
    if (!activeSession && !hasAuthCallbackInUrl()) {
      activeSession = await ensureSession()
    }

    if (!activeSession) {
      currentSession = null
      todos = []
      setErrorMessage('')
      isLoading = false
      isAuthSubmitting = false
      render()
      return
    }

    currentSession = activeSession
    const previousUser = previousSession?.user
    const activeUser = activeSession?.user
    const pendingAnonymousUserId = readPendingAnonymousUserId()
    const previousAnonymousUserId = previousUser?.is_anonymous
      ? previousUser.id
      : null
    const sourceAnonymousUserId = previousAnonymousUserId ?? pendingAnonymousUserId
    const shouldClaimAnonymousTodos =
      Boolean(sourceAnonymousUserId) &&
      Boolean(activeUser) &&
      !activeUser.is_anonymous &&
      sourceAnonymousUserId !== activeUser.id

    if (shouldClaimAnonymousTodos) {
      try {
        await claimAnonymousTodos(sourceAnonymousUserId)
        setAuthMessage('Signed in. Your guest todos were moved to this account.')
      } catch (error) {
        console.error('claim_anonymous_todos failed', {
          sourceAnonymousUserId,
          code: error?.code ?? null,
          message: error?.message ?? 'Unknown claim error',
        })
        setAuthMessage(
          'Signed in successfully. We could not move guest todos from your previous session.'
        )
        clearPendingAnonymousUserId()
      }
    }

    if (
      shouldClaimAnonymousTodos &&
      sourceAnonymousUserId === pendingAnonymousUserId
    ) {
      clearPendingAnonymousUserId()
    }

    if (activeUser && !activeUser.is_anonymous) clearPendingAnonymousUserId()

    todos = await listTodos()
    setErrorMessage('')
  } catch {
    setErrorMessage('Could not load todos. Check your Supabase configuration.')
  } finally {
    isLoading = false
    isAuthSubmitting = false
    render()
  }
}

async function handleSignUpSubmit(event) {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return

  try {
    isAuthSubmitting = true
    setErrorMessage('')
    setAuthMessage('')
    render()

    const currentUser = getCurrentUser()
    if (isAnonymousUser(currentUser)) {
      await linkAnonymousToEmailPassword(email, password)
      setAuthMessage('Account created and linked to your current guest session.')
    } else {
      const signUpData = await signUpWithEmail(email, password)
      setAuthMessage(
        signUpData.session
          ? 'Account created. You are now signed in.'
          : 'Account created. Check your email to confirm your address.'
      )
    }

    authModalMode = null
    const updatedSession = await getSession()
    await enqueueSyncSession(updatedSession)
  } catch {
    isAuthSubmitting = false
    setErrorMessage('Could not create account. Please check your details.')
    render()
  }
}

async function handleSignInSubmit(event) {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return

  try {
    const currentUser = getCurrentUser()
    if (isAnonymousUser(currentUser)) savePendingAnonymousUserId(currentUser.id)

    isAuthSubmitting = true
    setErrorMessage('')
    setAuthMessage('')
    render()

    await signInWithPassword(email, password)
    setAuthMessage('Signed in successfully.')
    authModalMode = null
    const updatedSession = await getSession()
    await enqueueSyncSession(updatedSession)
  } catch {
    clearPendingAnonymousUserId()
    isAuthSubmitting = false
    setErrorMessage('Could not sign in. Please verify your credentials.')
    render()
  }
}

async function handleForgotPasswordSubmit(event) {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const email = String(formData.get('email') ?? '').trim()
  if (!email) return

  try {
    isAuthSubmitting = true
    setErrorMessage('')
    setAuthMessage('')
    render()

    await requestPasswordReset(email)
    setAuthMessage(
      'If an account exists for that email, you will receive password reset instructions shortly.'
    )
    authModalMode = null
    isAuthSubmitting = false
    render()
  } catch {
    isAuthSubmitting = false
    setErrorMessage('Could not send reset email. Please try again.')
    render()
  }
}

async function handleChangePasswordSubmit(event) {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('password-confirm') ?? '')
  if (!password || password.length < 8) return
  if (password !== confirm) {
    setErrorMessage('New passwords do not match.')
    render()
    return
  }

  try {
    isAuthSubmitting = true
    setErrorMessage('')
    setAuthMessage('')
    render()

    await updateAccountPassword(password)
    setAuthMessage('Your password was updated.')
    authModalMode = null
    const updatedSession = await getSession()
    await enqueueSyncSession(updatedSession)
  } catch {
    isAuthSubmitting = false
    setErrorMessage('Could not update password. Please try again.')
    render()
  }
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('password-confirm') ?? '')
  if (!password || password.length < 8) return
  if (password !== confirm) {
    setErrorMessage('New passwords do not match.')
    render()
    return
  }

  try {
    isAuthSubmitting = true
    setErrorMessage('')
    setAuthMessage('')
    render()

    await updateAccountPassword(password)
    clearAuthHashFromUrl()
    setAuthMessage('Your password was reset. You are signed in.')
    authModalMode = null
    const updatedSession = await getSession()
    await enqueueSyncSession(updatedSession)
  } catch {
    isAuthSubmitting = false
    setErrorMessage('Could not reset password. Please try again.')
    render()
  }
}

async function handleSignOutClick() {
  try {
    isAuthSubmitting = true
    setErrorMessage('')
    setAuthMessage('')
    render()

    await signOutUser()
    setAuthMessage('Signed out. You are now in a new guest session.')
    await enqueueSyncSession(null)
  } catch {
    isAuthSubmitting = false
    setErrorMessage('Could not sign out. Please try again.')
    render()
  }
}

function handleAuthModalClick(event) {
  const targetElement = event.target.closest('[data-action]')
  if (!targetElement) return

  const { action } = targetElement.dataset

  if (action === 'open-sign-in-modal') {
    authModalMode = 'sign-in'
    render()
    return
  }

  if (action === 'open-sign-up-modal') {
    authModalMode = 'sign-up'
    render()
    return
  }

  if (action === 'open-forgot-password-modal') {
    authModalMode = 'forgot-password'
    render()
    return
  }

  if (action === 'open-change-password-modal') {
    authModalMode = 'change-password'
    render()
    return
  }

  if (action === 'close-auth-modal') {
    const isBackdropClick = targetElement.classList.contains('auth-modal-overlay')
    if (isBackdropClick && event.target !== targetElement) return

    authModalMode = null
    render()
  }
}

async function init() {
  const {
    data: { subscription },
  } = onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') authModalMode = 'reset-password'
    void enqueueSyncSession(session)
  })

  try {
    let session = await getSession()
    if (!session && !hasAuthCallbackInUrl()) session = await ensureSession()
    await enqueueSyncSession(session)

    if (hasAuthCallbackInUrl()) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      if (hashParams.get('type') === 'recovery') authModalMode = 'reset-password'
      render()
    }
  } catch {
    setErrorMessage('Could not load todos. Check your Supabase configuration.')
    isLoading = false
    render()
  }

  window.addEventListener('beforeunload', () => {
    subscription.unsubscribe()
  })
}

appElement.addEventListener('click', handleAuthModalClick)

void init()
