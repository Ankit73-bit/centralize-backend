#!/usr/bin/env python3
"""
PDF Helper Script for Node.js Integration
Provides compression, watermarking, and conversion functionality
"""
import sys
import json
import os
from pathlib import Path

# Try to import required libraries
try:
    from pikepdf import Pdf
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.colors import Color
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from pypdf import PdfWriter, PdfReader
    from io import BytesIO
    import math
except ImportError as e:
    print(json.dumps({
        'success': False,
        'error': f'Missing required library: {str(e)}',
        'install_command': 'pip install pikepdf reportlab pypdf pillow'
    }))
    sys.exit(1)


def compress_pdf(input_path, output_path, level='medium'):
    """
    Compress PDF with actual compression levels
    Levels: low, medium, high, extreme
    """
    try:
        pdf = Pdf.open(input_path)
        
        # Compression settings based on level
        save_options = {
            'low': {
                'compress_streams': True,
                'stream_decode_level': 0,
                'object_stream_mode': 0,
                'recompress_flate': False
            },
            'medium': {
                'compress_streams': True,
                'stream_decode_level': 1,
                'object_stream_mode': 1,
                'recompress_flate': True
            },
            'high': {
                'compress_streams': True,
                'stream_decode_level': 2,
                'object_stream_mode': 2,
                'recompress_flate': True
            },
            'extreme': {
                'compress_streams': True,
                'stream_decode_level': 3,
                'object_stream_mode': 2,
                'recompress_flate': True,
                'normalize_content': True
            }
        }
        
        options = save_options.get(level, save_options['medium'])
        pdf.save(output_path, **options)
        
        # Get file sizes
        input_size = os.path.getsize(input_path)
        output_size = os.path.getsize(output_path)
        saved_bytes = input_size - output_size
        compression_ratio = (saved_bytes / input_size * 100) if input_size > 0 else 0
        
        return {
            'success': True,
            'original_size': input_size,
            'compressed_size': output_size,
            'saved_bytes': saved_bytes,
            'compression_ratio': f"{compression_ratio:.2f}%",
            'level': level
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def add_watermark(input_path, output_path, text, options=None):
    """
    Add watermark to PDF with proper centering for diagonal position
    """
    try:
        if options is None:
            options = {}
        
        opacity = options.get('opacity', 0.3)
        font_size = options.get('fontSize', 48)
        rotation = options.get('rotation', 45)
        position = options.get('position', 'diagonal')
        color = options.get('color', {'r': 0.5, 'g': 0.5, 'b': 0.5})
        
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        for page_num, page in enumerate(reader.pages):
            # Get page dimensions
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)
            
            # Create watermark overlay
            packet = BytesIO()
            can = canvas.Canvas(packet, pagesize=(page_width, page_height))
            
            # Set transparency and color
            can.setFillColor(Color(color['r'], color['g'], color['b'], alpha=opacity))
            can.setFont("Helvetica-Bold", font_size)
            
            # Calculate text dimensions
            text_width = can.stringWidth(text, "Helvetica-Bold", font_size)
            
            if position == 'diagonal':
                # Calculate perfect center position
                center_x = page_width / 2
                center_y = page_height / 2
                
                # Save state, move to center, rotate, draw centered text
                can.saveState()
                can.translate(center_x, center_y)
                can.rotate(rotation)
                # Draw text centered at origin (which is now page center)
                can.drawCentredString(0, 0, text)
                can.restoreState()
                
            elif position == 'center':
                center_x = page_width / 2
                center_y = page_height / 2
                can.drawCentredString(center_x, center_y, text)
                
            elif position == 'top':
                center_x = page_width / 2
                can.drawCentredString(center_x, page_height - 50, text)
                
            elif position == 'bottom':
                center_x = page_width / 2
                can.drawCentredString(center_x, 50, text)
            
            can.save()
            
            # Move to beginning of BytesIO buffer
            packet.seek(0)
            watermark_pdf = PdfReader(packet)
            watermark_page = watermark_pdf.pages[0]
            
            # Merge watermark with page
            page.merge_page(watermark_page)
            writer.add_page(page)
        
        # Write output
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        return {
            'success': True,
            'pages': len(reader.pages),
            'watermark': text,
            'position': position
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    """Main entry point for command-line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'No operation specified',
            'usage': 'python pdf_helper.py <operation> <args...>',
            'operations': ['compress', 'watermark']
        }))
        sys.exit(1)
    
    operation = sys.argv[1]
    
    try:
        if operation == 'compress':
            if len(sys.argv) < 5:
                print(json.dumps({
                    'success': False,
                    'error': 'Usage: compress <input> <output> <level>',
                    'levels': ['low', 'medium', 'high', 'extreme']
                }))
                sys.exit(1)
            
            input_path = sys.argv[2]
            output_path = sys.argv[3]
            level = sys.argv[4]
            
            result = compress_pdf(input_path, output_path, level)
            print(json.dumps(result))
            
        elif operation == 'watermark':
            if len(sys.argv) < 5:
                print(json.dumps({
                    'success': False,
                    'error': 'Usage: watermark <input> <output> <text> [options_json]'
                }))
                sys.exit(1)
            
            input_path = sys.argv[2]
            output_path = sys.argv[3]
            text = sys.argv[4]
            options = json.loads(sys.argv[5]) if len(sys.argv) > 5 else {}
            
            result = add_watermark(input_path, output_path, text, options)
            print(json.dumps(result))
            
        else:
            print(json.dumps({
                'success': False,
                'error': f'Unknown operation: {operation}',
                'operations': ['compress', 'watermark']
            }))
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()