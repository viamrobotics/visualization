import { Browser, expect, Page, test } from '@playwright/test'
import { execSync } from 'child_process';

const createPage = async (browser: Browser): Promise<Page> => {
	const context = await browser.newContext()
	await context.addCookies([
		{
			name: 'weblab_experiments',
			value: 'MOTION_TOOLS_EDIT_FRAME',
			domain: 'localhost',
			path: '/',
		},]);
    let page = await context.newPage()
    await page.waitForTimeout(5000)
    page.on('console', (message) => {
        console.log(`[${message.type()}] ${message.text()}`)
    })
    await page.goto('/')
    await expect(page.getByText('World', { exact: true })).toBeVisible()
    return page
}

const takeScreenshot = async (page: Page, testPrefix: string, failedScreenshots: string[]) => {
    try {
		await expect(page).toHaveScreenshot(`${testPrefix}.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}.png`)
	}
}

const assertNoFailedScreenshots = (failedScreenshots: string[]) => {
    if (failedScreenshots.length > 0) {
        console.log(`Failed screenshots: ${failedScreenshots.join(', ')}`)
        throw new Error(`Failed screenshots: ${failedScreenshots.join(', ')}`)
    }
}

test('draw frame system', async ({ browser }) => {
    const testPrefix = 'DRAW_FRAME_SYSTEM'
    const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawFrameSystem$/DrawFrameSystem github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
   
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw frames', async ({ browser }) => {
	const testPrefix = 'DRAW_FRAMES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawFrames$/DrawFrames github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw geometries', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRIES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawGeometries$/DrawGeometries github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw geometries updating', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRIES_UPDATING'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawGeometriesUpdating$/DrawGeometriesUpdating github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw gltf', async ({ browser }) => {
	const testPrefix = 'DRAW_GLTF'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawGLTF$/DrawGLTF github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw lines', async ({ browser }) => {
	const testPrefix = 'DRAW_LINES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawLines$/DrawLine github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw nurbs', async ({ browser }) => {
	const testPrefix = 'DRAW_NURBS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawNurbs$/DrawNurbs github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})


test('draw point cloud', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUD'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawPointCloud$/DrawPointCloud github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw points', async ({ browser }) => {
	const testPrefix = 'DRAW_POINTS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawPoints$/DrawPoints github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw poses', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawPoses$/DrawPoses github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('draw world state', async ({ browser }) => {
	const testPrefix = 'DRAW_WORLD_STATE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestDrawWorldState$/DrawWorldState github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('remove spatial objects', async ({ browser }) => {
	const testPrefix = 'REMOVE_SPATIAL_OBJECTS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestRemoveSpatialObjects$/RemoveSpatialObjects github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})

test('set camera pose', async ({ browser }) => {
	const testPrefix = 'SET_CAMERA_POSE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

    execSync('go test -run ^TestSetCameraPose$/SetCameraPose github.com/viam-labs/motion-tools/client/client -count=1', {
        encoding: 'utf-8'
    });
    await takeScreenshot(page, testPrefix, failedScreenshots)

    assertNoFailedScreenshots(failedScreenshots)
})