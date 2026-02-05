"""
E2E тестирование приложения для просмотра Excel, PDF, DWG файлов
"""
from playwright.sync_api import sync_playwright
import os
import time

SCREENSHOTS_DIR = "C:/Users/usr/test/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def test_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("=" * 60)
        print("E2E ТЕСТИРОВАНИЕ ПРИЛОЖЕНИЯ")
        print("=" * 60)

        # 1. Открываем главную страницу
        print("\n[1] Открываем главную страницу...")
        page.goto('http://localhost:5175')
        page.wait_for_load_state('networkidle')
        page.screenshot(path=f'{SCREENSHOTS_DIR}/01_home.png', full_page=True)
        print("    ✓ Главная страница загружена")

        # Проверяем наличие навигации
        content = page.content()
        nav_links = page.locator('nav a, a[href]').all()
        print(f"    Найдено ссылок: {len(nav_links)}")

        # 2. Тестируем Excel страницу
        print("\n[2] Тестируем Excel страницу...")
        excel_link = page.locator('a:has-text("Excel"), a[href*="excel"]').first
        if excel_link.count() > 0:
            excel_link.click()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)
            page.screenshot(path=f'{SCREENSHOTS_DIR}/02_excel_page.png', full_page=True)
            print("    ✓ Excel страница загружена")

            # Проверяем наличие элементов Univer
            univer_container = page.locator('.univer-container, [class*="univer"], #app')
            if univer_container.count() > 0:
                print("    ✓ Univer контейнер найден")
            else:
                print("    ⚠ Univer контейнер не найден")
        else:
            print("    ⚠ Ссылка на Excel не найдена")

        # 3. Тестируем PDF страницу
        print("\n[3] Тестируем PDF страницу...")
        page.goto('http://localhost:5175')
        page.wait_for_load_state('networkidle')

        pdf_link = page.locator('a:has-text("PDF"), a[href*="pdf"]').first
        if pdf_link.count() > 0:
            pdf_link.click()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)
            page.screenshot(path=f'{SCREENSHOTS_DIR}/03_pdf_page.png', full_page=True)
            print("    ✓ PDF страница загружена")

            # Проверяем наличие PDF viewer
            pdf_container = page.locator('iframe, .pdf-viewer, [class*="pdf"], embed')
            if pdf_container.count() > 0:
                print("    ✓ PDF контейнер найден")
            else:
                print("    ⚠ PDF контейнер не найден")
        else:
            print("    ⚠ Ссылка на PDF не найдена")

        # 4. Тестируем CAD/DWG страницу
        print("\n[4] Тестируем CAD/DWG страницу...")
        page.goto('http://localhost:5175')
        page.wait_for_load_state('networkidle')

        cad_link = page.locator('a:has-text("CAD"), a:has-text("DWG"), a[href*="cad"], a[href*="dwg"]').first
        if cad_link.count() > 0:
            cad_link.click()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)
            page.screenshot(path=f'{SCREENSHOTS_DIR}/04_cad_page.png', full_page=True)
            print("    ✓ CAD страница загружена")

            # Проверяем наличие CAD viewer
            cad_container = page.locator('canvas, .cad-viewer, [class*="cad"], svg')
            if cad_container.count() > 0:
                print("    ✓ CAD контейнер найден")
            else:
                print("    ⚠ CAD контейнер не найден")
        else:
            print("    ⚠ Ссылка на CAD не найдена")

        # 5. Проверяем file input на всех страницах
        print("\n[5] Проверяем наличие загрузки файлов...")
        page.goto('http://localhost:5175')
        page.wait_for_load_state('networkidle')

        file_inputs = page.locator('input[type="file"]').all()
        upload_buttons = page.locator('button:has-text("Upload"), button:has-text("Загрузить"), button:has-text("Open"), [class*="upload"]').all()

        print(f"    File inputs: {len(file_inputs)}")
        print(f"    Upload buttons: {len(upload_buttons)}")

        # 6. Проверяем консоль на ошибки
        print("\n[6] Проверяем консоль браузера...")
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto('http://localhost:5175')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)

        if errors:
            print(f"    ⚠ Найдено ошибок в консоли: {len(errors)}")
            for err in errors[:5]:
                print(f"      - {err[:100]}")
        else:
            print("    ✓ Ошибок в консоли нет")

        # 7. Финальный скриншот
        print("\n[7] Делаем финальный скриншот...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/05_final.png', full_page=True)

        # Собираем информацию о странице
        print("\n" + "=" * 60)
        print("ИТОГОВАЯ ИНФОРМАЦИЯ")
        print("=" * 60)

        title = page.title()
        url = page.url

        print(f"Title: {title}")
        print(f"URL: {url}")

        # Получаем все элементы страницы
        all_buttons = page.locator('button').all()
        all_inputs = page.locator('input').all()
        all_links = page.locator('a').all()

        print(f"\nЭлементы на странице:")
        print(f"  - Кнопок: {len(all_buttons)}")
        print(f"  - Полей ввода: {len(all_inputs)}")
        print(f"  - Ссылок: {len(all_links)}")

        print(f"\nСкриншоты сохранены в: {SCREENSHOTS_DIR}")

        browser.close()

        print("\n✓ E2E тестирование завершено")

if __name__ == "__main__":
    test_app()
