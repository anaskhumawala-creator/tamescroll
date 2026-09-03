package app.tamescroll.client

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The delegate arbiter's decision (1101).
 *
 * His Redmi 13 ran every model on CPU because
 * `isDelegateSupportedOnThisDevice` answers out of a device database
 * frozen when tensorflow-lite-gpu 2.16.1 was built, and an unlisted
 * device was refused a GPU without ever trying one. 1101 tries anyway
 * and MEASURES. This is the bar that measurement has to clear -- a
 * delegate that merely initialises has proved nothing, and a driver
 * that takes the graph and returns garbage looks identical from Java
 * until its outputs are compared.
 */
class DelegateArbiterTest {
  @Test
  fun `a faster agreeing trial wins`() {
    assertTrue(NativeInfer.shouldSwap(true, 84.0, 210.0))
  }

  @Test
  fun `disagreement loses however fast it is`() {
    // The dangerous case: an accelerator that takes the graph and
    // returns numbers. Speed must never buy its way past agreement.
    assertFalse(NativeInfer.shouldSwap(false, 1.0, 210.0))
  }

  @Test
  fun `a hair's-breadth win is not worth the swap`() {
    // 10% margin: 189 is exactly the bar, and the bar is exclusive.
    assertFalse(NativeInfer.shouldSwap(true, 189.0, 210.0))
    assertTrue(NativeInfer.shouldSwap(true, 188.9, 210.0))
  }

  @Test
  fun `slower loses`() {
    assertFalse(NativeInfer.shouldSwap(true, 300.0, 210.0))
    assertFalse(NativeInfer.shouldSwap(true, 210.0, 210.0))
  }

  @Test
  fun `a missing measurement is not a win`() {
    // -1 is what the report carries for "never measured"; it must not
    // read as an infinitely fast delegate.
    assertFalse(NativeInfer.shouldSwap(true, -1.0, 210.0))
    assertFalse(NativeInfer.shouldSwap(true, 84.0, -1.0))
    assertFalse(NativeInfer.shouldSwap(true, 0.0, 0.0))
  }
}
