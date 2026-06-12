import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../DataTable';

interface TestRow {
  id: string;
  name: string;
  status: string;
}

const columns: ColumnDef<TestRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
];

const data: TestRow[] = [
  { id: '1', name: 'Store Alpha',  status: 'ACTIVE' },
  { id: '2', name: 'Store Beta',   status: 'PENDING' },
  { id: '3', name: 'Store Gamma',  status: 'SUSPENDED' },
];

describe('DataTable', () => {
  it('renders all column headers', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders all data rows', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Store Alpha')).toBeInTheDocument();
    expect(screen.getByText('Store Beta')).toBeInTheDocument();
    expect(screen.getByText('Store Gamma')).toBeInTheDocument();
  });

  it('shows empty title when data is empty', () => {
    render(
      <DataTable columns={columns} data={[]} emptyTitle="No stores found" emptyDesc="No stores yet." />,
    );
    expect(screen.getByText('No stores found')).toBeInTheDocument();
  });

  it('shows default empty title when data is empty', () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('shows loading state when isLoading = true', () => {
    render(<DataTable columns={columns} data={[]} isLoading={true} />);
    // Loading skeletons use animate-shimmer class
    const skeletons = document.querySelectorAll('.animate-shimmer');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows checkboxes when selectable = true', () => {
    render(<DataTable columns={columns} data={data} selectable={true} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // +1 for select-all header checkbox
    expect(checkboxes.length).toBeGreaterThanOrEqual(data.length);
  });

  it('does not show checkboxes when selectable = false', () => {
    render(<DataTable columns={columns} data={data} selectable={false} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('calls onSelectionChange when row checkbox is clicked', () => {
    const onSelectionChange = jest.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        selectable={true}
        onSelectionChange={onSelectionChange}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // Click first row checkbox (index 1, after header select-all)
    fireEvent.click(checkboxes[1]);
    expect(onSelectionChange).toHaveBeenCalled();
    // Get the last call (initial render fires once with [], click fires with [row])
    const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
    const selected = lastCall[0];
    expect(Array.isArray(selected)).toBe(true);
    expect(selected.length).toBe(1);
  });

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = jest.fn();
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Store Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('renders pagination controls when pagination prop provided', () => {
    const onPageChange = jest.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        pagination={{ page: 1, limit: 20, total: 50, onPageChange }}
      />,
    );
    // Should have page info or next/prev buttons (totalPages = 3 > 1, so controls render)
    expect(screen.getByText(/showing/i) || screen.getByRole('button')).toBeTruthy();
  });
});
