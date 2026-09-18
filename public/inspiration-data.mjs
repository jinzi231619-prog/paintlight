// Versioned editorial content, separate from museum metadata and filter evidence.
// These are AI-assisted readings of the local artwork images, not expert reviews.
const pair = (zh, en) => ({zh, en});
export const INSPIRATIONS = {
  'met-438417': {
    title: pair('把目光，交给远方', 'Let the gaze travel'),
    lens: pair('框景 · 人物与环境', 'Framing · People and place'),
    observation: pair('两个人物站在左侧，身体朝向远处。近处的树干与横伸枝条包围了一小片天空；月亮落在人物右方，远山比前景更浅。', 'Two figures stand on the left, facing away. Nearby trunks and reaching branches surround a small opening of sky. The moon sits to the right of the figures; the distant hills are lighter than the foreground.'),
    reading: pair('人物的朝向给视线一个去处。深色树木形成近处的边界，明亮而空的天空成为停留点。这是对画面关系的一种解读。', 'The figures give our gaze a direction. Dark trees establish a near boundary, while the brighter, open sky offers somewhere to pause. This is one reading of the visual relationships.'),
    experiment: pair('同一个位置，拍两种观看方式', 'One place, two ways of looking'),
    steps: [
      pair('找一处能安全停留的开阔景色，让同伴侧身或背对镜头，望向远处。先拍一张不带前景遮挡的照片。', 'Find an open view with a safe place to stand. Ask a companion to face the distance and make a photograph without a foreground frame.'),
      pair('保持人物和远景的位置关系，移动机位，让附近树枝或门框进入画面边缘，再拍一张。不要让枝条正好穿过头部。', 'Keep the relationship between the person and the view, then move so a nearby branch or doorway enters the edges. Avoid placing a branch directly across the head.'),
      pair('并排看两张：框景是在引导你看远处，还是让画面变得拥挤？保留更符合你想表达的距离感的一张。', 'Compare the two: does the frame lead you into the distance or make the image feel crowded? Keep the version that conveys the distance you want.')
    ],
    boundary: pair('可借用人物朝向和前后层次；无需寻找同样的月亮，也不能从画中推断拍摄参数。', 'Borrow the direction of the gaze and the layers of space. You do not need the same moon, and the painting cannot tell you camera settings.'),
    prompt: pair('我想让人物望向什么？准备用什么做前景？', 'What will the person look toward? What could frame the foreground?')
  },
  'met-441379': {
    title: pair('让一小片光，撑起整幅画', 'Let a little light carry the scene'),
    lens: pair('明暗 · 大小对照', 'Light and dark · Scale'),
    observation: pair('大面积暗色天空与海水之间，云隙和海面出现较亮的区域。下方的小船与远处横向延伸的山体形成大小对照。', 'Between broad areas of dark sky and water, lighter passages appear in the clouds and on the sea. A small boat below contrasts in scale with the long mass of land in the distance.'),
    reading: pair('亮处不多，反而容易吸引目光。小船让远处的山体显得更庞大；如果把所有暗部都提亮，这种对照可能减弱。', 'Because bright areas are scarce, they can hold attention. The small boat gives the distant land a sense of size. Lifting every shadow could weaken that contrast.'),
    experiment: pair('只留一个明亮的停留点', 'Keep one bright place to pause'),
    steps: [
      pair('在安全可达的岸边或城市街道，找一个小亮点和大片较暗环境，例如水面反光或远处窗户。不必等到深夜。', 'From a safe shoreline or street, find a small bright area in a darker setting: a reflection or a distant window, for example. You do not need to wait until late at night.'),
      pair('先拍下现场，再调整取景，排除画面边缘抢眼的亮点。检查亮处是否还保留你想要的细节。', 'Make a first frame, then recompose to exclude distracting bright areas at the edges. Check whether the light retains the detail you want.'),
      pair('比较两张照片中视线最先落在哪里；再试着保留一个小人物或物体，观察它是否帮助表现环境尺度。', 'Compare where your eye lands first. Try including a small figure or object and see whether it helps communicate the scale of the surroundings.')
    ],
    boundary: pair('画中的明暗经过绘画处理，不等于真实月光下相机会记录的亮度；请按现场光线判断。', 'The painted contrast is not a measurement of what a camera records in moonlight. Work with the light actually present.'),
    prompt: pair('这张照片唯一想让人注意的亮处是什么？', 'Which bright area do I want the viewer to notice?')
  },
  'met-437310': {
    title: pair('让街道，带着视线走', 'Follow the street into the picture'),
    lens: pair('纵深 · 重复与节奏', 'Depth · Repetition and rhythm'),
    observation: pair('从较高的位置看街道，右侧建筑和道路边缘向远处靠拢。近处车马较大，远处逐渐变小；树干与窗户反复出现。', 'The street is seen from above. The buildings on the right and the road edges converge into the distance. Nearby vehicles are larger, distant ones smaller; trunks and windows repeat across the view.'),
    reading: pair('边缘的汇聚与物体大小的变化共同制造纵深。重复的树和窗户提供节奏，街上的活动让这个秩序不至于太机械。', 'Converging edges and changing object sizes work together to create depth. Repeated trees and windows establish rhythm, while activity in the street interrupts the regularity.'),
    experiment: pair('先找到道路，再等一个变化', 'Find the structure, then wait for a variation'),
    steps: [
      pair('从允许拍摄且安全的位置观察街道。先让道路或建筑边缘把视线带入画面，不必追求高处。', 'Observe a street from a safe place where photography is allowed. Let a road or building edge lead into the frame; height is not essential.'),
      pair('保持机位，分别记录人车稀少和出现一处有趣活动的时刻。比较时尽量保留相同的取景范围。', 'Keep the camera position and photograph both a quiet moment and a moment with an interesting activity. Keep the framing similar for the comparison.'),
      pair('查看远处是否仍清楚可读，近处有没有截断得突兀的物体。选择能同时保留空间和活动节奏的一张。', 'Check that the distance remains readable and that near objects are not awkwardly cut off. Choose the frame that balances space and activity.')
    ],
    boundary: pair('可借用透视关系，不必照搬天气；这幅画的笔触也不能直接作为慢门效果的证据。', 'Borrow the perspective without copying the weather. Painted brushwork is not evidence of a slow-shutter effect.'),
    prompt: pair('哪条线把我带入画面？我想等到什么出现？', 'Which line leads me into the picture? What am I waiting to enter?')
  },
  'met-436535': {
    title: pair('给横向的风景，一个竖向回应', 'Give a horizontal landscape a vertical answer'),
    lens: pair('方向 · 色彩关系', 'Direction · Color relationships'),
    observation: pair('黄色麦田在画面下部横向展开，深色柏树在右侧向上伸展。天空和远山偏蓝，白云与麦田中的笔触呈弯曲、流动的形状。', 'A yellow wheat field stretches across the lower part of the picture, while dark cypresses rise on the right. The sky and distant hills lean blue; clouds and marks in the field take curved, flowing forms.'),
    reading: pair('柏树的竖向形状打断了田野的横向延伸。黄色与蓝色的大片关系容易被辨认，树的深色又形成一个重量更足的支点。', 'The upright cypresses interrupt the horizontal spread of the field. Broad yellow and blue areas are easy to distinguish, while the dark tree provides a stronger visual anchor.'),
    experiment: pair('为风景找到一个支点', 'Find an anchor for a landscape'),
    steps: [
      pair('找一个以横向色块为主的环境：田野、海岸，甚至一面分色墙。先拍下它原本的样子。', 'Find a scene dominated by horizontal areas of color: a field, a shoreline, or even a painted wall. Photograph it as you find it.'),
      pair('把树、路灯或站立的人物加入一侧；再拍一张。留意它是否和背景黏在一起，适当移动机位分开轮廓。', 'Include a tree, streetlight, or standing figure to one side and make another frame. Move if necessary to separate its outline from the background.'),
      pair('缩小两张照片看：哪个版本的主次更清楚？竖向物体是在稳定画面，还是抢走了你想保留的平静？', 'Look at both photographs small: which has a clearer hierarchy? Does the vertical object steady the scene or interrupt the calm you want to keep?')
    ],
    boundary: pair('摄影可以借用方向和色块关系；梵高的笔触并不要求你把照片处理成同样的纹理或饱和度。', 'Photography can borrow direction and areas of color. The brushwork does not require matching the texture or saturation in a photograph.'),
    prompt: pair('我的横向色块是什么？用什么作为竖向支点？', 'What are my horizontal areas of color? What could be a vertical anchor?')
  },
  'met-437881': {
    title: pair('把日常动作，放进窗边的光', 'Bring an everyday gesture to window light'),
    lens: pair('窗光 · 动作与留白', 'Window light · Gesture and space'),
    observation: pair('窗户在左侧，人物一只手伸向窗边，另一只手靠近水壶。浅色头巾与墙面相邻，下方是较深的衣裙，右下角铺着有纹样的织物。', 'The window is on the left. One hand reaches toward it, while the other is near the pitcher. A light head covering sits against the wall; darker clothing fills the lower figure, with patterned fabric at the lower right.'),
    reading: pair('手的动作把人物与周围物品联系起来。浅色头巾、脸部和墙面之间的明暗差异，让安静的动作也有可看的层次。', 'The hands connect the person with nearby objects. Tonal differences between the head covering, face, and wall give a quiet gesture layers to explore.'),
    experiment: pair('用一个动作，代替一个姿势', 'Try a gesture instead of a pose'),
    steps: [
      pair('在窗边找一块简洁背景，让同伴做一个真实的小动作，例如整理布料或拿起杯子。先观察脸与手是否看得清楚。', 'Find a simple background near a window and ask a companion to do a small everyday action, such as arranging fabric or lifting a cup. Check that the face and hands are readable.'),
      pair('请同伴缓慢重复动作，从两个角度各拍一张：一个更靠近窗的方向，一个更侧向的方向。现场光线决定曝光。', 'Ask them to repeat the action slowly. Photograph from two angles, one nearer the window direction and one more side-on. Choose exposure for the light on location.'),
      pair('比较手与身体是否重叠、背景是否干扰脸部，以及哪个角度更能看出动作。保留你希望观者先注意的部分。', 'Compare hand overlap, distractions behind the face, and how clearly each angle describes the action. Keep the parts you want a viewer to notice first.')
    ],
    boundary: pair('窗户在画中的位置可见，但具体布光和绘画过程不能仅凭图像确定。练习以你现场看到的光为准。', 'The window position is visible, but the exact lighting setup and painting process cannot be established from the image alone. Work from the light you can observe.'),
    prompt: pair('什么日常动作值得留下？脸与手怎样分开？', 'Which everyday gesture is worth keeping? How can I separate the face and hands?')
  }
};

export function inspirationFor(artwork) {
  if (!artwork || artwork.userAdded) return null;
  return Object.hasOwn(INSPIRATIONS, artwork.id) ? INSPIRATIONS[artwork.id] : null;
}
export const INSPIRATION_IDS = Object.keys(INSPIRATIONS);
export const INSPIRATION_REVISION = '2026-09-18.1';
