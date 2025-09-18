'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { createColumnHelper, useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AbilityBuilder, Ability } from '@casl/ability';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type User = {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer' | string;
  createdAt: string;
  plan?: 'free' | 'pro' | 'enterprise' | null;
};

async function fetchUsers(params: any) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch('/api/users?' + q, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to load');
  }
  return res.json();
}

export default function UsersPage() {
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'email' | 'createdAt' | 'role'>('email');
  const [desc, setDesc] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { can } = new AbilityBuilder(Ability).build({
    can: [{ action: 'manage', subject: 'all' }],
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers({ limit: pageSize, search, sortBy, desc }),
    refetchOnWindowFocus: true,
    retry: 3,
    onSuccess: (payload: any) => {
      if (payload?.data?.length === 1) {
        setSelectedRowId(payload.data[0].id);
      }
    },
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }, [search, sortBy, desc, pageSize, queryClient]);

  const columnHelper = createColumnHelper<User>();
  const columns = [
    columnHelper.accessor('email', {
      header: () => <span>Email</span>,
      cell: (info) => {
        const u = info.row.original;
        return (
          <div onClick={() => setSelectedRowId(u.id)}>
            <Link href={`/users/${u.id}`}>{u.email}</Link>
            <div>{new Date(u.createdAt).toLocaleString()}</div>
          </div>
        );
      },
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => <span>{info.getValue()}</span>,
    }),
    columnHelper.accessor('plan', {
      header: 'Plan',
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const user = info.row.original;
        const canEdit = can('manage', 'all') || user.role !== 'admin';
        return (
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                const res = await fetch('/api/users/' + user.id + '/refresh', { method: 'POST' });
                if (res.ok) {
                  queryClient.invalidateQueries({ queryKey: ['users'] });
                }
              }}
              disabled={!canEdit}
            >
              Refresh
            </Button>
            <Button variant="destructive" onClick={() => fetch('/api/users/' + user.id, { method: 'DELETE' })}>
              Delete
            </Button>
          </div>
        );
      },
    }),
  ];

  const data: User[] = usersQuery.data?.data || [];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    debugTable: process.env.NODE_ENV !== 'production',
  });

  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  if (usersQuery.isLoading) {
    return <div>Loading...</div>;
  }
  if (usersQuery.error) {
    return <div role="alert">Something went wrong</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <input
          placeholder="Search email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded-md w-64"
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="border px-2 py-2 rounded-md">
          <option value="email">Email</option>
          <option value="createdAt">Created</option>
          <option value="role">Role</option>
        </select>
        <Button onClick={() => setDesc((d) => !d)}>{desc ? 'Desc' : 'Asc'}</Button>
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border px-2 py-2 rounded-md">
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>{n}/page</option>
          ))}
        </select>
        {isTouch && <span className="text-xs opacity-60">Touch mode</span>}
      </div>

      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="text-left p-3">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={row.original.id === selectedRowId ? 'bg-muted' : ''}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-3 border-t">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}>Reload</Button>
        <Button onClick={() => alert(JSON.stringify(usersQuery.data))}>Debug</Button>
      </div>
    </div>
  );
}
