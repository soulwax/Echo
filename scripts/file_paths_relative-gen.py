# File: scripts/file_paths_relative-gen.py

import os
import fnmatch
import chardet

def should_process(file, whitelist_extensions, ignore_patterns):
    return (any(file.endswith(ext) for ext in whitelist_extensions) and
            not any(fnmatch.fnmatch(file, pattern) for pattern in ignore_patterns))

def get_comment_style(file_extension):
    if file_extension == '.py':
        return ('#', '')
    elif file_extension in ['.css', '.scss', '.less']:
        return ('/*', '*/')
    elif file_extension in ['.html', '.xml', '.svg']:
        return ('<!--', '-->')
    else:
        return ('//', '')

def add_relative_path(file_path, root_dir):
    try:
        with open(file_path, 'rb') as file:
            raw_content = file.read()
        
        # Detect the file encoding
        result = chardet.detect(raw_content)
        encoding = result['encoding']
        
        # Decode the content using the detected encoding
        content = raw_content.decode(encoding)
        
        # Check if the file already starts with a "// File:" comment
        if content.lstrip().startswith("// File:"):
            print(f"Skipped (Already has file comment): {os.path.relpath(file_path, root_dir)}")
            return

        relative_path = os.path.relpath(file_path, root_dir)
        file_extension = os.path.splitext(file_path)[1].lower()
        comment_start, comment_end = get_comment_style(file_extension)
        
        if comment_end:
            new_content = f"{comment_start} File: {relative_path} {comment_end}\n\n{content}"
        else:
            new_content = f"{comment_start} File: {relative_path}\n\n{content}"
        
        with open(file_path, 'w', encoding=encoding) as file:
            file.write(new_content)
        
        print(f"Processed: {relative_path}")
    except (UnicodeDecodeError, TypeError):
        print(f"Skipped (Unable to decode): {os.path.relpath(file_path, root_dir)}")

def process_directory(directory, whitelist_extensions, ignore_patterns):
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if not any(fnmatch.fnmatch(d, pattern) for pattern in ignore_patterns)]
        
        for file in files:
            if should_process(file, whitelist_extensions, ignore_patterns):
                file_path = os.path.join(root, file)
                add_relative_path(file_path, directory)

if __name__ == "__main__":
    project_root = "."  # Assumes the script is run from the project root
    
    # Whitelist of file extensions to process
    whitelist_extensions = [
        ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".scss", ".less",
        ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".go", ".rb", ".php",
        ".swift", ".kt", ".rs", ".scala", ".elm", ".coffee", ".lua", ".xml", ".svg"
    ]
    
    # Patterns for directories or files to ignore
    ignore_patterns = ["node_modules", "*.git*", "*.idea*", "*.vscode*"]
    
    process_directory(project_root, whitelist_extensions, ignore_patterns)
    print("Relative paths have been added to all appropriate files.")
