/**
 ****************************************************************************************************
 * @file        atk_mc5640_dcmi.c
 * @author      ����ԭ���Ŷ�(ALIENTEK)
 * @version     V1.0
 * @date        2022-06-21
 * @brief       ATK-MC5640ģ��DCMI�ӿ���������
 * @license     Copyright (c) 2020-2032, �������������ӿƼ����޹�˾
 ****************************************************************************************************
 * @attention
 *
 * ʵ��ƽ̨:����ԭ�� ̽���� F407������
 * ������Ƶ:www.yuanzige.com
 * ������̳:www.openedv.com
 * ��˾��ַ:www.alientek.com
 * �����ַ:openedv.taobao.com
 *
 ****************************************************************************************************
 */

#include "./BSP/ATK_MC5640/atk_mc5640_dcmi.h"

/* ATK-MC5640ģ��DCMI�ӿ����ݽṹ�� */
static struct
{
    DCMI_HandleTypeDef dcmi;
    uint8_t frame_sem;
} g_atk_mc5640_dcmi_sta = {0};


/**
 * @brief       ATK-MC5640ģ��DCMI�ӿ��жϷ�����
 * @param       ��
 * @retval      ��
 */
void ATK_MC5640_DCMI_IRQHandler(void)
{
     HAL_DCMI_IRQHandler(&g_atk_mc5640_dcmi_sta.dcmi);
}


/**
 * @brief       ATK-MC5640ģ��DCMI�ӿ�DMA�жϷ�����
 * @param       ��
 * @retval      ��
 */
void ATK_MC5640_DCMI_DMA_IRQHandler(void)
{
    HAL_DMA_IRQHandler(g_atk_mc5640_dcmi_sta.dcmi.DMA_Handle);
}

/**
 * @brief       ATK-MC5640ģ��DCMI�ӿ�֡�жϻص�����
 * @param       ��
 * @retval      ��
 */
void HAL_DCMI_FrameEventCallback(DCMI_HandleTypeDef *hdcmi)
{
    if (hdcmi == &g_atk_mc5640_dcmi_sta.dcmi)
    {
        g_atk_mc5640_dcmi_sta.frame_sem = 1;
    }
}

/**
 * @brief       DCMI�ײ��ʼ��
 * @param       ��
 * @retval      ��
 */
void HAL_DCMI_MspInit(DCMI_HandleTypeDef* hdcmi)
{
    GPIO_InitTypeDef gpio_init_struct = {0};
    static DMA_HandleTypeDef dma_handle = {0};
    
    if (hdcmi == &g_atk_mc5640_dcmi_sta.dcmi)
    {
        /* ʹ��ʱ�� */
        ATK_MC5640_DCMI_CLK_ENABLE();
        ATK_MC5640_DCMI_DMA_CLK_ENABLE();
        ATK_MC5640_DCMI_VSYNC_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_HSYNC_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_PIXCLK_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_D0_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_D1_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_D2_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_D3_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_D4_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_D5_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_D6_GPIO_CLK_ENABLE();
        ATK_MC5640_DCMI_D7_GPIO_CLK_ENABLE();
        
        /* ��ʼ��VSYNC���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_VSYNC_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_VSYNC_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_VSYNC_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��HSYNC���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_HSYNC_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_HSYNC_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_HSYNC_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��PIXCLK���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_PIXCLK_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_PIXCLK_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_PIXCLK_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��D0���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_D0_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_D0_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_D0_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��D1���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_D1_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_D1_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_D1_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��D2���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_D2_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_D2_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_D2_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��D3���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_D3_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_D3_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_D3_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��D4���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_D4_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_D4_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_D4_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��D5���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_D5_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_D5_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_D5_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��D6���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_D6_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_D6_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_D6_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��D7���� */
        gpio_init_struct.Pin        = ATK_MC5640_DCMI_D7_GPIO_PIN;
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull       = GPIO_PULLUP;
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate  = ATK_MC5640_DCMI_D7_GPIO_AF;
        HAL_GPIO_Init(ATK_MC5640_DCMI_D7_GPIO_PORT, &gpio_init_struct);
        
        /* ��ʼ��DMA */
        dma_handle.Instance                 = ATK_MC5640_DCMI_DMA_INTERFACE;
        dma_handle.Init.Channel             = ATK_MC5640_DCMI_DMA_CHANNEL;
        dma_handle.Init.Direction           = DMA_PERIPH_TO_MEMORY;
        dma_handle.Init.PeriphInc           = DMA_PINC_DISABLE;
        dma_handle.Init.MemInc              = DMA_MINC_DISABLE;
        dma_handle.Init.PeriphDataAlignment = DMA_PDATAALIGN_WORD;
        dma_handle.Init.MemDataAlignment    = DMA_MDATAALIGN_HALFWORD;
        dma_handle.Init.Mode                = DMA_CIRCULAR;
        dma_handle.Init.Priority            = DMA_PRIORITY_HIGH;
        dma_handle.Init.FIFOMode            = DMA_FIFOMODE_ENABLE;
        dma_handle.Init.FIFOThreshold       = DMA_FIFO_THRESHOLD_HALFFULL;
        dma_handle.Init.MemBurst            = DMA_MBURST_SINGLE;
        dma_handle.Init.PeriphBurst         = DMA_PBURST_SINGLE;
        __HAL_LINKDMA(hdcmi, DMA_Handle, dma_handle);
        HAL_DMA_Init(&dma_handle);
        
        /* ����DCMI�ж� */
        HAL_NVIC_SetPriority(ATK_MC5640_DCMI_IRQn, 2, 2);
        HAL_NVIC_EnableIRQ(ATK_MC5640_DCMI_IRQn);
        
        /* ����DMA�ж� */
        HAL_NVIC_SetPriority(ATK_MC5640_DCMI_DMA_IRQn, 2, 3);
        HAL_NVIC_EnableIRQ(ATK_MC5640_DCMI_DMA_IRQn);
    }
}

/**
 * @brief       ��ʼ��ATK-MC5640ģ��DCMI�ӿ�
 * @param       ��
 * @retval      ��
 */
void atk_mc5640_dcmi_init(void)
{
    g_atk_mc5640_dcmi_sta.dcmi.Instance                 = ATK_MC5640_DCMI_INTERFACE;
    g_atk_mc5640_dcmi_sta.dcmi.Init.SynchroMode         = DCMI_SYNCHRO_HARDWARE;
    g_atk_mc5640_dcmi_sta.dcmi.Init.PCKPolarity         = DCMI_PCKPOLARITY_RISING;
    g_atk_mc5640_dcmi_sta.dcmi.Init.VSPolarity          = DCMI_VSPOLARITY_LOW;
    g_atk_mc5640_dcmi_sta.dcmi.Init.HSPolarity          = DCMI_HSPOLARITY_LOW;
    g_atk_mc5640_dcmi_sta.dcmi.Init.CaptureRate         = DCMI_CR_ALL_FRAME;
    g_atk_mc5640_dcmi_sta.dcmi.Init.ExtendedDataMode    = DCMI_EXTEND_DATA_8B;
    g_atk_mc5640_dcmi_sta.dcmi.Init.JPEGMode            = DCMI_JPEG_DISABLE;
    HAL_DCMI_Init(&g_atk_mc5640_dcmi_sta.dcmi);
}

/**
 * @brief       ��ʼATK-MC5640ģ��DCMI�ӿ�DMA����
 * @param       dts_addr        : ֡���ݵĽ���Ŀ�ĵ�ַ
 *              meminc          : DMA_MINC_DISABLE: ֡���ݽ��յ�Ŀ�ĵ�ַ�Զ�����
 *                                DMA_MINC_ENABLE : ֡���ݽ��յ�Ŀ�ĵ�ַ���Զ�����
 *              memdataalignment: DMA_MDATAALIGN_BYTE    : ֡���ݽ��ջ����λ��Ϊ8����
 *                                DMA_MDATAALIGN_HALFWORD: ֡���ݽ��ջ����λ��Ϊ16����
 *                                DMA_MDATAALIGN_WORD    : ֡���ݽ��ջ����λ��Ϊ32����
 *              len             : �����֡���ݴ�С
 * @retval      ��
 */
void atk_mc5640_dcmi_start(uint32_t dts_addr, uint32_t meminc, uint32_t memdataalignment, uint32_t len)
{
    /* ����������������DMA */
    g_atk_mc5640_dcmi_sta.dcmi.DMA_Handle->Init.MemInc = meminc;
    g_atk_mc5640_dcmi_sta.dcmi.DMA_Handle->Init.MemDataAlignment = memdataalignment;
    HAL_DMA_Init(g_atk_mc5640_dcmi_sta.dcmi.DMA_Handle);
    
    /* ���֡������ɱ��
     * ʹ��DCMI֡�����ж�
     */
    g_atk_mc5640_dcmi_sta.frame_sem = 0;
    __HAL_DCMI_ENABLE_IT(&g_atk_mc5640_dcmi_sta.dcmi, DCMI_IT_FRAME);
    HAL_DCMI_Start_DMA(&g_atk_mc5640_dcmi_sta.dcmi, DCMI_MODE_SNAPSHOT, dts_addr, len);
    
    /* �ȴ�������� */
    while (g_atk_mc5640_dcmi_sta.frame_sem == 0);
    HAL_DCMI_Stop(&g_atk_mc5640_dcmi_sta.dcmi);
}
