import re
import json
import os
import time

# --- 配置 ---
# 请将此名称修改为你的实际 TXT 文件名
INPUT_FILENAME = "all_unique_final_shapes.txt"
OUTPUT_DIR = "web_data"  # 输出目录
SHAPES_PER_CHUNK = 100000  # 1000,000 个图形一份


# ------------


def parse_shape_blocks(lines):
    """
    从文件的文本行中解析出一个完整的图形数据 (匹配你旧的 main.py 逻辑)
    """
    shape_blocks = []
    # 正则表达式用于匹配 "x,y,type" 格式
    pattern = re.compile(r'(\d+),(\d+),(\d+)')

    # 将多行文本合并为一行进行匹配
    full_line = " ".join(lines)
    matches = pattern.findall(full_line)

    for match in matches:
        # 将匹配到的字符串转换为整数
        shape_blocks.append({
            'x': int(match[0]),
            'y': int(match[1]),
            'type': int(match[2])
        })
    return shape_blocks


def write_chunk(index, data, data_dir):
    """ 将一个分块的数据写入 JSONL 文件。"""
    output_filename = os.path.join(data_dir, f"chunk_{index}.json")
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            for shape in data:
                # JSONL 格式：每行一个 JSON 对象，使用紧凑格式
                json.dump(shape, f, separators=(',', ':'))
                f.write('\n')
    except IOError as e:
        print(f"错误: 无法写入文件 {output_filename}: {e}")


def generate_chunks(input_file, output_dir, shapes_per_chunk):
    """
    根据 TXT 文件的多行分隔符结构，将输入文件分割成 JSONL 分块文件。
    """
    print(f"--- 开始 Web 数据分块预处理 ---")
    print(f"输入文件: '{input_file}'")
    print(f"每个分块文件将包含 {shapes_per_chunk:,} 个图形。")

    data_dir = os.path.join(output_dir, "chunks")
    os.makedirs(data_dir, exist_ok=True)

    total_shapes = 0
    current_shape_lines = []
    current_chunk_data = []
    chunk_index = 0
    start_time = time.time()

    try:
        with open(input_file, 'r', encoding='utf-8') as f_in:
            for line in f_in:
                line = line.strip()

                is_separator = False
                # 判断是否是图形分隔符
                if not line or line.startswith("Shape #") or line.startswith("[Total Unique"):
                    is_separator = True

                if is_separator:
                    if current_shape_lines:
                        # 1. 解析图形
                        blocks = parse_shape_blocks(current_shape_lines)

                        if blocks:
                            total_shapes += 1
                            shape_data = {"id": total_shapes, "blocks": blocks}
                            current_chunk_data.append(shape_data)

                            # 2. 达到分块大小，写入文件
                            if total_shapes % shapes_per_chunk == 0:
                                chunk_index += 1
                                write_chunk(chunk_index, current_chunk_data, data_dir)
                                current_chunk_data = []  # 清空当前分块

                                elapsed = time.time() - start_time
                                print(f"已处理 {total_shapes:,} 个图形，写入分块 #{chunk_index}。 (耗时: {elapsed:.2f}s)")

                        current_shape_lines = []  # 清空已处理的图形行

                # 收集当前图形的块数据行，并忽略汇总行
                elif not line.startswith("["):
                    current_shape_lines.append(line)

            # 3. 文件末尾：处理最后一个图形和最后一个不完整的 chunk
            if current_shape_lines:
                blocks = parse_shape_blocks(current_shape_lines)
                if blocks:
                    total_shapes += 1
                    shape_data = {"id": total_shapes, "blocks": blocks}
                    current_chunk_data.append(shape_data)

            if current_chunk_data:
                chunk_index += 1
                write_chunk(chunk_index, current_chunk_data, data_dir)

    except FileNotFoundError:
        print(f"错误: 输入文件 '{input_file}' 未找到。")
        return

    # 4. 创建主信息文件
    total_chunks = chunk_index
    info_filename = os.path.join(output_dir, "info.json")
    try:
        with open(info_filename, 'w', encoding='utf-8') as f:
            json.dump({
                "total_shapes": total_shapes,
                "shapes_per_chunk": shapes_per_chunk,
                "total_chunks": total_chunks
            }, f, indent=4)
        print(f"\n已创建主信息文件: '{info_filename}'")
    except IOError as e:
        print(f"错误: 无法写入 info 文件: {e}")

    end_time = time.time()
    print(f"\n--- 预处理完成 ---")
    print(f"总共 {total_shapes:,} 个图形被分割成 {total_chunks} 个分块文件。")
    print(f"总共用时: {end_time - start_time:.2f} 秒")


if __name__ == "__main__":
    if not os.path.exists(INPUT_FILENAME):
        print(f"错误: 未在当前目录找到 '{INPUT_FILENAME}'。")
        print("请将此脚本与你的 .txt 文件放在同一文件夹下，或修改 INPUT_FILENAME 变量。")
    else:
        # 使用 100,000 个图形一份
        generate_chunks(INPUT_FILENAME, OUTPUT_DIR, SHAPES_PER_CHUNK)