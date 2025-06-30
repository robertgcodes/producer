'use client';

import { useState, useEffect } from 'react';
import { Bundle } from '@/types';
import { ChevronRightIcon, FolderIcon, FolderOpenIcon, DocumentIcon, PlusIcon } from '@heroicons/react/24/outline';

interface BundleNode extends Bundle {
  children?: BundleNode[];
  isExpanded?: boolean;
}

interface BundleSidebarProps {
  bundles: Bundle[];
  activeBundle: string | null;
  onBundleSelect: (bundleId: string) => void;
  onCreateBundle: () => void;
  onCreateChildBundle?: (parentId: string) => void;
  onReorderBundles?: (bundles: Bundle[]) => void;
}

export function BundleSidebar({ 
  bundles, 
  activeBundle, 
  onBundleSelect, 
  onCreateBundle,
  onCreateChildBundle,
  onReorderBundles 
}: BundleSidebarProps) {
  const [bundleTree, setBundleTree] = useState<BundleNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [draggedBundleId, setDraggedBundleId] = useState<string | null>(null);
  const [dragOverBundleId, setDragOverBundleId] = useState<string | null>(null);

  // Convert flat bundles to tree structure
  useEffect(() => {
    const buildTree = (bundles: Bundle[]): BundleNode[] => {
      const bundleMap = new Map<string, BundleNode>();
      const rootBundles: BundleNode[] = [];

      // First pass: create all nodes
      bundles.forEach(bundle => {
        bundleMap.set(bundle.id, { ...bundle, children: [] });
      });

      // Second pass: build tree structure
      bundles.forEach(bundle => {
        const node = bundleMap.get(bundle.id)!;
        if (bundle.parentId && bundleMap.has(bundle.parentId)) {
          const parent = bundleMap.get(bundle.parentId)!;
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          rootBundles.push(node);
        }
      });

      return rootBundles;
    };

    setBundleTree(buildTree(bundles));
  }, [bundles]);

  const toggleExpanded = (bundleId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(bundleId)) {
        next.delete(bundleId);
      } else {
        next.add(bundleId);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, bundleId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBundleId(bundleId);
  };

  const handleDragOver = (e: React.DragEvent, bundleId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBundleId(bundleId);
  };

  const handleDragLeave = () => {
    setDragOverBundleId(null);
  };

  const handleDrop = (e: React.DragEvent, targetBundleId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedBundleId && draggedBundleId !== targetBundleId && onReorderBundles) {
      // Find positions of dragged and target bundles
      const draggedIndex = bundles.findIndex(b => b.id === draggedBundleId);
      const targetIndex = bundles.findIndex(b => b.id === targetBundleId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        // Create new array with reordered bundles
        const newBundles = [...bundles];
        const [draggedBundle] = newBundles.splice(draggedIndex, 1);
        
        // Insert at the target position
        const insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex;
        newBundles.splice(insertIndex, 0, draggedBundle);
        
        // Update order property for all bundles
        const reorderedBundles = newBundles.map((bundle, index) => ({
          ...bundle,
          order: index
        }));
        
        onReorderBundles(reorderedBundles);
      }
    }
    
    setDraggedBundleId(null);
    setDragOverBundleId(null);
  };

  const handleDragEnd = () => {
    setDraggedBundleId(null);
    setDragOverBundleId(null);
  };

  const renderBundleNode = (node: BundleNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isActive = node.id === activeBundle;

    return (
      <div key={node.id}>
        <div
          className={`
            group flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg transition-all
            ${isActive 
              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            }
            ${dragOverBundleId === node.id ? 'ring-2 ring-brand-500 dark:ring-brand-400' : ''}
            ${draggedBundleId === node.id ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
          onClick={() => onBundleSelect(node.id)}
          draggable={level === 0} // Only allow dragging root-level bundles
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id)}
          onDragEnd={handleDragEnd}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <ChevronRightIcon 
                className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          
          {!hasChildren && <div className="w-4" />}
          
          {/* Icon/Emoji Display */}
          <div className="w-5 h-5 flex items-center justify-center">
            {node.icon ? (
              <span className="text-base">{node.icon}</span>
            ) : hasChildren ? (
              isExpanded ? <FolderOpenIcon className="w-4 h-4" /> : <FolderIcon className="w-4 h-4" />
            ) : (
              <DocumentIcon className="w-4 h-4" />
            )}
          </div>
          
          <span className="flex-1 text-sm font-medium truncate">{node.title}</span>
          
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {node.storyCount || 0}
          </span>

          {onCreateChildBundle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateChildBundle(node.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Add sub-bundle"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          )}
          
          {/* Drag handle for root-level bundles */}
          {level === 0 && (
            <div className="cursor-move opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderBundleNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 relative">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bundles</h2>
          <button
            onClick={() => {
              console.log('Plus button clicked');
              onCreateBundle();
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors z-10"
            title="Create new bundle"
          >
            <PlusIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {bundleTree.length === 0 ? (
          <div className="text-center py-8">
            <FolderIcon className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No bundles yet</p>
            <button
              onClick={onCreateBundle}
              className="mt-2 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Create your first bundle
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {bundleTree.map(node => renderBundleNode(node))}
          </div>
        )}
      </div>
    </div>
  );
}