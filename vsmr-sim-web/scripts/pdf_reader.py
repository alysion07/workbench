"""
PDF Reader for MARS Manual
Reads PDF files from public/resource/ref/ and extracts text content
"""

import sys
import os
from pathlib import Path

try:
    import PyPDF2
except ImportError:
    print("PyPDF2 not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2"])
    import PyPDF2

def read_pdf(pdf_path: str, start_page: int = 0, end_page: int = None, search_text: str = None):
    """
    Read PDF file and extract text content
    
    Args:
        pdf_path: Path to PDF file
        start_page: Starting page (0-indexed)
        end_page: Ending page (0-indexed, None for all)
        search_text: Optional text to search for
    """
    try:
        # Set UTF-8 encoding for output
        if sys.stdout.encoding != 'utf-8':
            import io
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            total_pages = len(pdf_reader.pages)
            
            print(f"PDF: {os.path.basename(pdf_path)}")
            print(f"Total pages: {total_pages}")
            print("=" * 80)
            
            if end_page is None:
                end_page = total_pages
            else:
                end_page = min(end_page, total_pages)
            
            all_text = []
            for page_num in range(start_page, end_page):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                
                # Replace problematic characters
                text = text.encode('utf-8', errors='replace').decode('utf-8')
                
                if search_text:
                    if search_text.lower() in text.lower():
                        print(f"\n--- Page {page_num + 1} (Found: '{search_text}') ---")
                        print(text)
                        print("-" * 80)
                        all_text.append(text)
                else:
                    print(f"\n--- Page {page_num + 1} ---")
                    print(text)
                    print("-" * 80)
                    all_text.append(text)
            
            return '\n\n'.join(all_text)
            
    except Exception as e:
        print(f"Error reading PDF: {e}")
        import traceback
        traceback.print_exc()
        return None

def list_pdfs(directory: str = "public/resource/ref"):
    """List all PDF files in directory"""
    pdf_dir = Path(directory)
    if not pdf_dir.exists():
        print(f"Directory not found: {directory}")
        return []
    
    pdfs = []
    for pdf_file in pdf_dir.rglob("*.pdf"):
        rel_path = pdf_file.relative_to(pdf_dir)
        pdfs.append(str(rel_path))
    
    return sorted(pdfs)

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  List PDFs:           python pdf_reader.py list")
        print("  Read entire PDF:     python pdf_reader.py <pdf_name>")
        print("  Read specific pages: python pdf_reader.py <pdf_name> <start_page> <end_page>")
        print("  Search in PDF:       python pdf_reader.py <pdf_name> search <search_text>")
        print("\nExample:")
        print("  python pdf_reader.py list")
        print('  python pdf_reader.py "8 HYDRODYNAMIC COMPONENTS/8.6 PIPE.pdf"')
        print('  python pdf_reader.py "8.6 PIPE.pdf" 0 5')
        print('  python pdf_reader.py "8.6 PIPE.pdf" search "spread"')
        return
    
    command = sys.argv[1]
    
    if command == "list":
        print("Available PDF files:")
        print("=" * 80)
        for pdf in list_pdfs():
            print(f"  {pdf}")
        return
    
    # Find PDF file
    pdf_name = command
    base_dir = Path("public/resource/ref")
    
    # Try direct path first
    pdf_path = base_dir / pdf_name
    if not pdf_path.exists():
        # Try searching by filename
        found = list(base_dir.rglob(f"*{pdf_name}*"))
        if found:
            pdf_path = found[0]
        else:
            print(f"PDF not found: {pdf_name}")
            print("\nAvailable PDFs:")
            for pdf in list_pdfs():
                print(f"  {pdf}")
            return
    
    # Parse additional arguments
    start_page = 0
    end_page = None
    search_text = None
    
    if len(sys.argv) >= 3:
        if sys.argv[2] == "search":
            if len(sys.argv) >= 4:
                search_text = sys.argv[3]
        else:
            start_page = int(sys.argv[2])
            if len(sys.argv) >= 4:
                end_page = int(sys.argv[3])
    
    # Read PDF
    read_pdf(str(pdf_path), start_page, end_page, search_text)

if __name__ == "__main__":
    main()

