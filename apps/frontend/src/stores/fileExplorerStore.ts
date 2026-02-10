/**
 * File Explorer Store — Zustand state for the project file tree.
 */

import { create } from "zustand";
import {
  getVirtualFileSystem,
  detectFileLanguage,
  type FileNode,
  type FileContent,
} from "../engines/projectFileSystem";

interface FileExplorerState {
  /** File tree root */
  tree: FileNode | null;
  /** Set of expanded directory paths */
  expandedPaths: Set<string>;
  /** Currently selected file path */
  selectedPath: string | null;
  /** Project root path */
  projectRoot: string;

  /** Actions */
  loadTree: () => void;
  toggleExpand: (path: string) => void;
  selectFile: (path: string) => void;
  readFile: (path: string) => FileContent | null;
  createFile: (dirPath: string, name: string, content?: string) => void;
  createDirectory: (parentPath: string, name: string) => void;
  deleteNode: (path: string) => void;
  renameNode: (oldPath: string, newName: string) => void;
  refreshTree: () => void;
}

export const useFileExplorerStore = create<FileExplorerState>((set, get) => ({
  tree: null,
  expandedPaths: new Set(["/project", "/project/rtl", "/project/tb"]),
  selectedPath: null,
  projectRoot: "/project",

  loadTree: () => {
    const vfs = getVirtualFileSystem();
    const tree = vfs.buildFileTree();
    set({ tree });
  },

  toggleExpand: (path) =>
    set((s) => {
      const next = new Set(s.expandedPaths);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedPaths: next };
    }),

  selectFile: (path) => set({ selectedPath: path }),

  readFile: (path) => {
    const vfs = getVirtualFileSystem();
    const content = vfs.readFile(path);
    if (content === null) return null;
    const filename = path.split("/").pop() ?? "";
    return {
      path,
      content,
      language: detectFileLanguage(filename),
      size: content.length,
    };
  },

  createFile: (dirPath, name, content = "") => {
    const vfs = getVirtualFileSystem();
    const path = `${dirPath}/${name}`;
    vfs.createFile(path, content);
    get().refreshTree();
  },

  createDirectory: (parentPath, name) => {
    const vfs = getVirtualFileSystem();
    // Create a placeholder file to represent the directory
    const path = `${parentPath}/${name}/.keep`;
    vfs.createFile(path, "");
    set((s) => {
      const next = new Set(s.expandedPaths);
      next.add(`${parentPath}/${name}`);
      return { expandedPaths: next };
    });
    get().refreshTree();
  },

  deleteNode: (path) => {
    const vfs = getVirtualFileSystem();
    vfs.deleteFile(path);
    get().refreshTree();
  },

  renameNode: (oldPath, newName) => {
    const vfs = getVirtualFileSystem();
    const parts = oldPath.split("/");
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");
    vfs.renameFile(oldPath, newPath);
    get().refreshTree();
  },

  refreshTree: () => {
    const vfs = getVirtualFileSystem();
    const tree = vfs.buildFileTree();
    set({ tree });
  },
}));
