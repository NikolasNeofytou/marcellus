/**
 * FileExplorerPanel — Real file tree browser with expand/collapse,
 * file icons, and context-aware actions.
 */

import { useEffect, useCallback } from "react";
import { useFileExplorerStore } from "../../stores/fileExplorerStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { type FileNode } from "../../engines/projectFileSystem";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Cpu,
  Wrench,
  Plus,
  FolderPlus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import "./FileExplorerPanel.css";

export function FileExplorerPanel() {
  const tree = useFileExplorerStore((s) => s.tree);
  const expandedPaths = useFileExplorerStore((s) => s.expandedPaths);
  const selectedPath = useFileExplorerStore((s) => s.selectedPath);
  const loadTree = useFileExplorerStore((s) => s.loadTree);
  const toggleExpand = useFileExplorerStore((s) => s.toggleExpand);
  const selectFile = useFileExplorerStore((s) => s.selectFile);
  const createNewFile = useFileExplorerStore((s) => s.createFile);
  const createDirectory = useFileExplorerStore((s) => s.createDirectory);
  const deleteNode = useFileExplorerStore((s) => s.deleteNode);
  const refreshTree = useFileExplorerStore((s) => s.refreshTree);
  const addTab = useWorkspaceStore((s) => s.addTab);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const getFileIcon = useCallback((node: FileNode) => {
    if (node.type === "directory") {
      return expandedPaths.has(node.path) ? (
        <FolderOpen size={16} className="file-icon file-icon--folder-open" />
      ) : (
        <Folder size={16} className="file-icon file-icon--folder" />
      );
    }
    const ext = node.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "v":
      case "sv":
      case "vh":
      case "svh":
        return <FileCode size={16} className="file-icon file-icon--verilog" />;
      case "vhd":
      case "vhdl":
        return <FileCode size={16} className="file-icon file-icon--vhdl" />;
      case "spice":
      case "sp":
      case "cir":
        return <Cpu size={16} className="file-icon file-icon--spice" />;
      case "sdc":
      case "tcl":
        return <Wrench size={16} className="file-icon file-icon--constraint" />;
      case "md":
      case "txt":
      case "log":
        return <FileText size={16} className="file-icon file-icon--text" />;
      default:
        return <File size={16} className="file-icon file-icon--default" />;
    }
  }, [expandedPaths]);

  const handleNodeClick = useCallback(
    (node: FileNode) => {
      if (node.type === "directory") {
        toggleExpand(node.path);
      } else {
        selectFile(node.path);
        // Determine tab type based on file extension
        const ext = node.name.split(".").pop()?.toLowerCase() ?? "";
        const hdlExts = ["v", "sv", "vh", "svh", "vhd", "vhdl"];
        const tabType = hdlExts.includes(ext) ? "hdl" : "welcome";
        addTab({
          id: `file-${node.path}`,
          title: node.name,
          type: tabType as "hdl" | "welcome",
          modified: false,
        });
      }
    },
    [toggleExpand, selectFile, addTab]
  );

  const handleNewFile = useCallback(() => {
    const name = prompt("New file name:");
    if (name) {
      const dir = selectedPath ?? "/project";
      createNewFile(dir, name);
    }
  }, [selectedPath, createNewFile]);

  const handleNewFolder = useCallback(() => {
    const name = prompt("New folder name:");
    if (name) {
      const dir = selectedPath ?? "/project";
      createDirectory(dir, name);
    }
  }, [selectedPath, createDirectory]);

  const handleDelete = useCallback(() => {
    if (selectedPath && confirm(`Delete "${selectedPath}"?`)) {
      deleteNode(selectedPath);
    }
  }, [selectedPath, deleteNode]);

  const renderNode = (node: FileNode, depth: number) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;
    const paddingLeft = 8 + depth * 16;

    return (
      <div key={node.path}>
        <div
          className={`file-tree__node ${isSelected ? "file-tree__node--selected" : ""}`}
          style={{ paddingLeft }}
          onClick={() => handleNodeClick(node)}
          role="treeitem"
          aria-expanded={node.type === "directory" ? isExpanded : undefined}
          aria-selected={isSelected}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleNodeClick(node);
            }
          }}
        >
          {node.type === "directory" && (
            <span className="file-tree__chevron">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {node.type === "file" && <span className="file-tree__chevron-spacer" />}
          {getFileIcon(node)}
          <span className="file-tree__name">{node.name}</span>
        </div>
        {node.type === "directory" && isExpanded && node.children && (
          <div role="group">
            {node.children
              .sort((a, b) => {
                // Folders first, then alphabetical
                if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-explorer" role="tree" aria-label="File explorer">
      <div className="file-explorer__toolbar">
        <button
          className="file-explorer__action"
          onClick={handleNewFile}
          title="New File"
          aria-label="New File"
        >
          <Plus size={14} />
        </button>
        <button
          className="file-explorer__action"
          onClick={handleNewFolder}
          title="New Folder"
          aria-label="New Folder"
        >
          <FolderPlus size={14} />
        </button>
        <button
          className="file-explorer__action"
          onClick={handleDelete}
          title="Delete"
          aria-label="Delete"
          disabled={!selectedPath}
        >
          <Trash2 size={14} />
        </button>
        <button
          className="file-explorer__action"
          onClick={refreshTree}
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="file-explorer__tree">
        {tree ? (
          renderNode(tree, 0)
        ) : (
          <div className="file-explorer__empty">Loading project files...</div>
        )}
      </div>
    </div>
  );
}
