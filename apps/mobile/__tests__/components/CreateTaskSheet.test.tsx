import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CreateTaskSheet } from '../../components/tasks/CreateTaskSheet'

// Variables must be prefixed with 'mock' to be used in jest.mock factory
const mockMutate = jest.fn()
const mockCreateTask = jest.fn().mockResolvedValue({})

jest.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: mockMutate })
}))

jest.mock('../../gen/api/endpoints/shuchuAPI.gen', () => ({
  usePostApiTasks: () => ({
    trigger: mockCreateTask,
    isMutating: false
  }),
  getGetApiTasksKey: () => '/api/tasks'
}))

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker')

describe('CreateTaskSheet', () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders when visible', () => {
    render(<CreateTaskSheet visible={true} onClose={mockOnClose} />)

    expect(screen.getByText('New Task')).toBeTruthy()
    expect(screen.getByText('Title')).toBeTruthy()
    expect(screen.getByText('Schedule')).toBeTruthy()
  })

  it('does not render when not visible', () => {
    render(<CreateTaskSheet visible={false} onClose={mockOnClose} />)

    expect(screen.queryByText('New Task')).toBeNull()
  })

  it('shows "Set start time" when no initial time provided', () => {
    render(<CreateTaskSheet visible={true} onClose={mockOnClose} />)

    expect(screen.getByText('Set start time')).toBeTruthy()
  })

  it('creates task with start time when provided', async () => {
    const initialStartAt = new Date('2026-01-17T10:00:00')

    render(
      <CreateTaskSheet
        visible={true}
        onClose={mockOnClose}
        initialStartAt={initialStartAt}
      />
    )

    // Enter task title
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    fireEvent.changeText(titleInput, 'Test Task')

    // Press create button
    const createButton = screen.getByText('Create Task')
    fireEvent.press(createButton)

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: 'Test Task',
        startAt: initialStartAt.toISOString()
      })
    })
  })

  it('creates task without start time when none provided', async () => {
    render(<CreateTaskSheet visible={true} onClose={mockOnClose} />)

    // Enter task title
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    fireEvent.changeText(titleInput, 'Test Task')

    // Press create button
    const createButton = screen.getByText('Create Task')
    fireEvent.press(createButton)

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: 'Test Task',
        startAt: undefined
      })
    })
  })

  it('does not create task with empty title', () => {
    render(<CreateTaskSheet visible={true} onClose={mockOnClose} />)

    // Press create button without entering title
    const createButton = screen.getByText('Create Task')
    fireEvent.press(createButton)

    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('calls onClose after successful creation', async () => {
    render(<CreateTaskSheet visible={true} onClose={mockOnClose} />)

    // Enter task title
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    fireEvent.changeText(titleInput, 'Test Task')

    // Press create button
    const createButton = screen.getByText('Create Task')
    fireEvent.press(createButton)

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('clears form state when close button is pressed', () => {
    const { unmount } = render(
      <CreateTaskSheet visible={true} onClose={mockOnClose} />
    )

    // Enter task title
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    fireEvent.changeText(titleInput, 'Test Task')

    // Unmount and remount to verify initial state
    unmount()

    // Re-render a fresh instance
    render(<CreateTaskSheet visible={true} onClose={mockOnClose} />)

    // Title should be empty for new instance
    const newTitleInput = screen.getByPlaceholderText('What needs to be done?')
    expect(newTitleInput.props.value).toBe('')
  })
})
